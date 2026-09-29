import { payment, upiLink } from '@/content/payment'
import { programSession } from '@/content/program'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import { placeHold } from '@/lib/registration/flow'
import { validateHold } from '@/lib/registration/validate'
import { launchStatus } from '@/lib/tickets/launch'

/**
 * The payment step of the v3 flow. Validates everything the student chose
 * and typed on the server, decides the amount from content, and makes the
 * AWAITING_PAYMENT record with its seats held for ninety minutes, or moves
 * the hold this browser already made. Returns what the payment screen needs.
 * Nothing here verifies anyone.
 *
 * Rate limits. The audience is students on college wifi, hundreds behind one
 * NATed address, so a per-IP limit tight enough to matter would 429 a whole
 * campus on launch morning. The limit that protects people is per email; the
 * per-IP ceiling is only there so one connection cannot mint thousands of
 * holds, and it sits far above anything a campus produces in an hour.
 */
const PER_EMAIL_PER_HOUR = 8
const PER_IP_PER_HOUR = 500

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  // The switch, read from the table on this request. A direct POST while
  // closed is refused here and creates nothing; hiding the page is not
  // the enforcement.
  const launch = await launchStatus()
  if (!launch.registrationOpen) return json(403, { ok: false, reason: 'closed', message: 'Registrations are closed.' })
  if (launch.enforced && launch.blockers.length) {
    console.error(`[hold] REFUSED. registration is open but selling is blocked: ${launch.blockers.map((b) => b.detail).join(' | ')}`)
    return json(503, { ok: false, message: 'Registration is paused for a moment. Nothing was charged. Try again later.' })
  }

  const body: unknown = await req.json().catch(() => null)
  const v = validateHold(body)
  if ('error' in v) return json(400, { ok: false, ...v.error })

  if (!(await withinRateLimit(`email:${v.input.email}`, 'HOLD', PER_EMAIL_PER_HOUR))) {
    return json(429, {
      ok: false,
      field: 'email',
      message: `${v.input.email} has been used for ${PER_EMAIL_PER_HOUR} registrations in the last hour, so this one was not started. Nothing was charged. Wait an hour and try again.`,
    })
  }
  if (!(await withinRateLimit(callerIp(req), 'HOLD', PER_IP_PER_HOUR))) {
    return json(429, { ok: false, message: 'Too many registrations from this network in the last hour. Nothing was charged. Try again a little later.' })
  }

  const out = await placeHold(v.input, v.submissionKey, v.passId, 'checkout')
  if (!out.ok) {
    const s = programSession(out.sessionId)
    const isWorkshop = s?.kind === 'workshop'
    return json(409, {
      ok: false,
      reason: 'full',
      field: isWorkshop ? 'workshop' : 'tech',
      sessionId: out.sessionId,
      message: `${s?.title ?? 'That session'} just filled up. Pick another ${isWorkshop ? 'workshop' : 'technical session'}; nothing was charged.`,
    })
  }

  const a = out.attendee
  const account = payment.live
  console.info(`[hold] ${a.passId} ${out.moved ? 'moved' : 'held'}, ${a.amountPaise} paise, ${a.technicalSession}${a.workshop ? `+${a.workshop}` : ''}`)
  return json(200, {
    ok: true,
    passId: a.passId,
    amountPaise: a.amountPaise,
    holdUntil: a.holdUntil,
    upi: {
      // Never shown: the page prints no payee or UPI id, only the QR.
      payee: null,
      // Null while the UPI id is unset: the page shows the gap instead of a QR that pays nobody.
      link: account ? upiLink(account, a.passId) : null,
    },
  })
}
