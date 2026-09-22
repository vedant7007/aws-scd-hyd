import { tierIds } from '@/content/passes'
import { payment } from '@/content/payment'
import { trackName } from '@/content/sessions'
import { tracks as trackList } from '@/content/tracks'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import { YEARS_OF_STUDY, type FoodPreference, type Tier, type Track, type YearOfStudy } from '@/lib/db/types'
import { stepOne } from '@/lib/registration/flow'
import type { Registration } from '@/lib/registration/state'
import { launchStatus } from '@/lib/tickets/launch'
import { paymentMode } from '@/lib/tickets/mode'

/**
 * Step one of registration. Amendment 1 section 2.1. Validates the form on
 * the server, decides the amount from content, and creates the
 * AWAITING_PAYMENT record against its home track's counter. Returns what
 * the payment screen needs. Nothing here verifies anyone.
 *
 * The body is allowed to contain exactly the registration fields plus the
 * browser's submission key. Anything else, an amount above all, is a 400:
 * the price is not a parameter.
 *
 * Rate limits. The audience is students on college wifi, hundreds behind one
 * NATed address, so a per-IP limit tight enough to matter would 429 a whole
 * campus on launch morning. The limit that protects people is per email: one
 * person retrying a few times is fine, a script cycling one address is not.
 * The per-IP ceiling is only there so one connection cannot mint thousands
 * of records, and it sits far above anything a campus produces in an hour.
 */
const PER_EMAIL_PER_HOUR = 5
const PER_IP_PER_HOUR = 500

const FIELDS = ['name', 'email', 'phone', 'college', 'yearOfStudy', 'tier', 'homeTrack', 'foodPreference', 'over18', 'submissionKey'] as const
const FOODS: FoodPreference[] = ['veg', 'nonveg']
const TRACK_IDS = trackList.map((t) => t.id)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SUBMISSION_KEY = /^[A-Za-z0-9_-]{16,64}$/

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * Indian mobile numbers: ten digits starting 6 to 9, with or without +91 or a
 * leading 0, spaces and dashes tolerated. Stored as +91XXXXXXXXXX.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '')
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits)
  return m ? `+91${m[1]}` : null
}

type Invalid = { field: string; message: string }

function validate(body: unknown): { reg: Registration; submissionKey: string } | { error: Invalid } {
  if (typeof body !== 'object' || body === null) return { error: { field: 'body', message: 'Send a JSON object.' } }
  const b = body as Record<string, unknown>

  for (const key of Object.keys(b)) {
    if (!(FIELDS as readonly string[]).includes(key)) return { error: { field: key, message: `"${key}" is not accepted.` } }
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

  const year = b.yearOfStudy
  if (typeof year !== 'string' || !YEARS_OF_STUDY.includes(year as YearOfStudy)) return { error: { field: 'yearOfStudy', message: 'Pick your year of study.' } }

  const tier = b.tier
  if (typeof tier !== 'string' || !tierIds.includes(tier as Tier)) return { error: { field: 'tier', message: 'Pick a pass.' } }

  const homeTrack = b.homeTrack
  if (typeof homeTrack !== 'string' || !TRACK_IDS.includes(homeTrack as Track)) return { error: { field: 'homeTrack', message: 'Pick your track.' } }

  const food = b.foodPreference
  if (typeof food !== 'string' || !FOODS.includes(food as FoodPreference)) return { error: { field: 'foodPreference', message: 'Pick a food preference.' } }

  // The 18+ confirmation. Anything but a literal true is a refusal, not a default.
  if (b.over18 !== true) return { error: { field: 'over18', message: 'Attendees must be 18 or older on the day. Tick the box to confirm.' } }

  const submissionKey = b.submissionKey
  if (typeof submissionKey !== 'string' || !SUBMISSION_KEY.test(submissionKey)) return { error: { field: 'submissionKey', message: 'Reload the form and try again.' } }

  return {
    reg: { name, email, phone, college, yearOfStudy: year as YearOfStudy, tier: tier as Tier, homeTrack: homeTrack as Track, foodPreference: food as FoodPreference, over18: true },
    submissionKey,
  }
}

export async function POST(req: Request): Promise<Response> {
  // The switch, read from the table on this request. A direct POST while
  // closed is refused here and creates nothing; hiding the button is not
  // the enforcement.
  const launch = await launchStatus()
  if (!launch.registrationOpen) return json(403, { ok: false, reason: 'closed', message: 'Registrations are closed.' })

  // The guard. registrationOpen is true and the configuration cannot seat or
  // verify anyone. Refuse, say why in the log, and tell the visitor nothing
  // about the configuration.
  if (launch.enforced && launch.blockers.length) {
    console.error(`[register] REFUSED. registrationOpen is true but selling is blocked: ${launch.blockers.map((b) => b.detail).join(' | ')}`)
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
      message: `${v.reg.email} has started ${PER_EMAIL_PER_HOUR} registrations in the last hour, so this one was not started. If one of them went through, the pass id is in that inbox. Otherwise wait an hour and try again; nothing was charged.`,
    })
  }
  if (!(await withinRateLimit(callerIp(req), 'CHK', PER_IP_PER_HOUR))) {
    return json(429, {
      ok: false,
      reason: 'network',
      message: `More than ${PER_IP_PER_HOUR} registrations have come from this network in the last hour, which is the ceiling we keep against abuse, so this one was not started. Nothing was charged. Try again a little later, or from a different connection.`,
    })
  }

  const out = await stepOne(v.reg, v.submissionKey)
  if (!out.ok) {
    if (out.reason === 'track-full') {
      return json(409, {
        ok: false,
        field: 'homeTrack',
        reason: 'track-full',
        track: out.track,
        message: `The ${trackName(out.track)} track is full, so nothing was booked. Pick a different track.`,
      })
    }
    return json(502, { ok: false, message: out.message })
  }

  const a = out.attendee
  console.info(`[register] ${a.passId} awaiting payment, ${a.amountPaise} paise${a.earlyBird ? ' (early bird)' : out.earlyBirdMissed ? ' (early bird ran out, full price)' : ''}, ${a.homeTrack}${out.duplicate ? ' (duplicate submission, same record)' : ''}${out.placeholder ? ' PLACEHOLDER' : ''}`)

  return json(200, {
    ok: true,
    mode: paymentMode(),
    passId: a.passId,
    amountPaise: a.amountPaise,
    placeholder: out.placeholder,
    earlyBird: a.earlyBird === true,
    earlyBirdMissed: out.earlyBirdMissed,
    holdUntil: a.holdUntil,
    payUrl: `/register/pay/${a.passId}`,
    upi: { qr: payment.qrAssetPath, upiId: payment.upiId, payee: payment.payeeName, note: a.passId },
    ...(out.order ? { order: out.order, prefill: { name: a.name, email: a.email, contact: a.phone } } : {}),
  })
}
