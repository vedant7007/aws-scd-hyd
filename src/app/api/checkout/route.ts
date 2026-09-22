import { tierIds, tracksAllowedFor } from '@/content/passes'
import { tracks as trackList } from '@/content/tracks'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import type { FoodPreference, Tier, Track } from '@/lib/db/types'
import { newTicketRef } from '@/lib/db/keys'
import { trackFullMessage } from '@/lib/db/seats'
import { createPendingAttendee, type CreateOutcome, type Registration } from '@/lib/db/writes'
import { launchStatus } from '@/lib/tickets/launch'
import { amountFor } from '@/lib/tickets/pricing'
import { createOrder } from '@/lib/tickets/razorpay'

/**
 * Step one of paying. Validates the form on the server, decides the amount
 * from content, creates the provider order for that amount, and writes the
 * pending record. Returns what the browser needs to open Checkout and to poll
 * for the result. Nothing here marks anyone paid.
 *
 * The body is allowed to contain exactly the registration fields. Anything
 * else, an amount above all, is a 400: the price is not a parameter.
 *
 * Rate limits. The audience is students on college wifi, hundreds behind one
 * NATed address, so a per-IP limit tight enough to matter would 429 a whole
 * campus on launch morning. The limit that protects people is per email: one
 * person retrying a few times is fine, a script cycling one address is not.
 * The per-IP ceiling is only there so one connection cannot mint thousands
 * of orders, and it sits far above anything a campus produces in an hour.
 */
const PER_EMAIL_PER_HOUR = 5
const PER_IP_PER_HOUR = 500

const FIELDS = ['name', 'email', 'phone', 'college', 'tier', 'tracks', 'foodPreference'] as const
const TRACK_IDS = trackList.map((t) => t.id)
const FOODS: FoodPreference[] = ['veg', 'nonveg', 'jain']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * Indian mobile numbers: ten digits starting 6 to 9, with or without +91 or a
 * leading 0, spaces and dashes tolerated. Stored as +91XXXXXXXXXX so the
 * gateway prefill and any later SMS see one shape.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '')
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits)
  return m ? `+91${m[1]}` : null
}

type Invalid = { field: string; message: string }

function validate(body: unknown): { reg: Registration } | { error: Invalid } {
  if (typeof body !== 'object' || body === null) return { error: { field: 'body', message: 'Send a JSON object.' } }
  const b = body as Record<string, unknown>

  for (const key of Object.keys(b)) {
    if (!(FIELDS as readonly string[]).includes(key)) {
      return { error: { field: key, message: `"${key}" is not accepted.` } }
    }
  }

  const str = (k: (typeof FIELDS)[number], min: number, max: number): string | null => {
    const v = b[k]
    if (typeof v !== 'string') return null
    const t = v.trim().replace(/\s+/g, ' ')
    return t.length >= min && t.length <= max ? t : null
  }

  const name = str('name', 2, 80)
  if (!name) return { error: { field: 'name', message: 'Your name, two to eighty characters.' } }

  const email = str('email', 3, 254)
  if (!email || !EMAIL.test(email)) return { error: { field: 'email', message: 'That does not look like an email address.' } }

  const phoneRaw = str('phone', 10, 20)
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null
  if (!phone) return { error: { field: 'phone', message: 'A ten digit Indian mobile number.' } }

  const college = str('college', 2, 120)
  if (!college) return { error: { field: 'college', message: 'Your college or organisation.' } }

  const tier = b.tier
  if (typeof tier !== 'string' || !tierIds.includes(tier as Tier)) {
    return { error: { field: 'tier', message: 'Pick a pass.' } }
  }

  // Tracks: distinct, known, at least one, and no more than the tier allows.
  // A seat is held in every session of each, so this is the whole choice.
  const raw = b.tracks
  if (!Array.isArray(raw) || raw.length === 0 || !raw.every((t) => typeof t === 'string' && TRACK_IDS.includes(t as Track))) {
    return { error: { field: 'tracks', message: 'Pick at least one track.' } }
  }
  const tracks = [...new Set(raw as Track[])]
  const allowed = tracksAllowedFor(tier as Tier)
  if (tracks.length > allowed) {
    return { error: { field: 'tracks', message: `That pass covers ${allowed} track${allowed === 1 ? '' : 's'}. Pick ${allowed}.` } }
  }

  const food = b.foodPreference
  if (typeof food !== 'string' || !FOODS.includes(food as FoodPreference)) {
    return { error: { field: 'foodPreference', message: 'Pick a food preference.' } }
  }

  return { reg: { name, email, phone, college, tier: tier as Tier, tracks, foodPreference: food as FoodPreference } }
}

export async function POST(req: Request): Promise<Response> {
  const launch = launchStatus()
  if (!launch.registrationOpen) return json(403, { ok: false, message: 'Registration is not open yet.' })

  // The guard. registrationOpen is true and the configuration would sell
  // one rupee passes through test keys. Refuse, say why in the log, and tell
  // the visitor nothing about the configuration.
  if (launch.enforced && launch.blockers.length) {
    console.error(
      `[checkout] REFUSED. registrationOpen is true but selling is blocked: ${launch.blockers.map((b) => b.detail).join(' | ')}`,
    )
    return json(503, { ok: false, message: 'Registration is paused for a moment. Nothing was charged. Try again later.' })
  }

  const body: unknown = await req.json().catch(() => null)
  const v = validate(body)
  if ('error' in v) return json(400, { ok: false, ...v.error })

  // Per email first, since that is the one a person can hit honestly.
  if (!(await withinRateLimit(`email:${v.reg.email.toLowerCase()}`, 'CHK', PER_EMAIL_PER_HOUR))) {
    return json(429, {
      ok: false,
      field: 'email',
      reason: 'email',
      message: `${v.reg.email} has started ${PER_EMAIL_PER_HOUR} registrations in the last hour, so this one was not started. If one of them was paid, the pass is already in that inbox. Otherwise wait an hour and try again; nothing was charged.`,
    })
  }

  if (!(await withinRateLimit(callerIp(req), 'CHK', PER_IP_PER_HOUR))) {
    return json(429, {
      ok: false,
      reason: 'network',
      message: `More than ${PER_IP_PER_HOUR} registrations have come from this network in the last hour, which is the ceiling we keep against abuse, so this one was not started. Nothing was charged. Try again a little later, or from a different connection.`,
    })
  }

  // The amount comes from content, full stop. It is computed here, sent to the
  // provider here, and stored on the record here. The browser only ever sees it.
  const amount = amountFor(v.reg.tier)

  const ticketRef = newTicketRef()
  let order
  try {
    // Order first: an order with no record is harmless, a record with no order
    // is a pending row that can never be paid.
    order = await createOrder({ ticketRef, amountPaise: amount.amountPaise, tier: v.reg.tier })
  } catch (err) {
    console.error('[checkout] order creation failed', err)
    return json(502, { ok: false, message: 'The payment provider did not respond. Nothing was charged. Try again.' })
  }

  // Record and seats in one transaction. A full track cancels the whole thing
  // and names itself; the order stays at the provider unpaid, which is harmless.
  let created: CreateOutcome = await createPendingAttendee(ticketRef, v.reg, {
    mode: 'razorpay',
    orderId: order.orderId,
    amountPaise: order.amountPaise,
  })
  if (!created.ok && created.reason === 'ref-collision') {
    created = await createPendingAttendee(newTicketRef(), v.reg, { mode: 'razorpay', orderId: order.orderId, amountPaise: order.amountPaise })
  }
  if (!created.ok) {
    if (created.reason === 'track-full') {
      return json(409, { ok: false, field: 'tracks', reason: 'track-full', track: created.track, message: trackFullMessage(created.track) })
    }
    return json(503, { ok: false, message: 'Could not start the registration. Nothing was charged. Try again.' })
  }
  const { attendee } = created
  console.info(`[checkout] ${attendee.ticketRef} pending, order ${order.orderId}, ${order.amountPaise} paise, tracks ${attendee.tracks.join('+')}${amount.placeholder ? ' PLACEHOLDER' : ''}`)

  return json(200, {
    ok: true,
    ticketRef: attendee.ticketRef,
    checkoutToken: attendee.checkoutToken,
    orderId: order.orderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    keyId: order.keyId,
    placeholder: amount.placeholder,
    prefill: { name: attendee.name, email: attendee.email, contact: attendee.phone },
  })
}
