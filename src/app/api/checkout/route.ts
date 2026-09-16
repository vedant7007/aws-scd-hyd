import { registrationOpen } from '@/content/event'
import { tierIds } from '@/content/passes'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import type { FoodPreference, Tier } from '@/lib/db/types'
import { newTicketRef } from '@/lib/db/keys'
import { createPendingAttendee, type Registration } from '@/lib/db/writes'
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
 */
const LIMIT_PER_HOUR = 10

const FIELDS = ['name', 'email', 'phone', 'college', 'tier', 'foodPreference'] as const
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

  const food = b.foodPreference
  if (typeof food !== 'string' || !FOODS.includes(food as FoodPreference)) {
    return { error: { field: 'foodPreference', message: 'Pick a food preference.' } }
  }

  return { reg: { name, email, phone, college, tier: tier as Tier, foodPreference: food as FoodPreference } }
}

export async function POST(req: Request): Promise<Response> {
  if (!registrationOpen) return json(403, { ok: false, message: 'Registration is not open yet.' })

  const body: unknown = await req.json().catch(() => null)
  const v = validate(body)
  if ('error' in v) return json(400, { ok: false, ...v.error })

  if (!(await withinRateLimit(callerIp(req), 'CHK', LIMIT_PER_HOUR))) {
    return json(429, { ok: false, message: 'Too many attempts from one connection. Try again in an hour.' })
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

  const attendee = await createPendingAttendee(ticketRef, v.reg, { orderId: order.orderId, amountPaise: order.amountPaise })
  console.info(`[checkout] ${attendee.ticketRef} pending, order ${order.orderId}, ${order.amountPaise} paise${amount.placeholder ? ' PLACEHOLDER' : ''}`)

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
