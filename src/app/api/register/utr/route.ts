import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { stepTwo } from '@/lib/registration/flow'
import { screenshotExists } from '@/lib/registration/screenshots'
import { VERIFICATION_WINDOW } from '@/lib/email/templates'

/**
 * Step two of registration. Amendment 1 section 2.2. The UTR and the key of
 * the screenshot the browser just uploaded. Moves AWAITING_PAYMENT (or
 * REJECTED, on a resubmission) to PENDING_VERIFICATION and sends email 1.
 *
 * The UTR is validated here, on the server: exactly twelve digits. The
 * table, not this code, enforces that a UTR is used once: a second
 * submission of the same UTR from any pass fails the transaction.
 */
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { passId?: unknown; utr?: unknown; screenshotKey?: unknown } | null
  const passId = typeof body?.passId === 'string' ? normalisePassId(body.passId) : null
  const utr = typeof body?.utr === 'string' ? body.utr.replace(/\s+/g, '') : ''
  const screenshotKey = typeof body?.screenshotKey === 'string' ? body.screenshotKey : ''

  if (!passId) return json(400, { ok: false, field: 'passId', message: 'That is not a pass id.' })
  if (!/^\d{12}$/.test(utr)) return json(400, { ok: false, field: 'utr', message: 'A UTR is exactly 12 digits. It is in your UPI app under the payment.' })
  if (!screenshotKey) return json(400, { ok: false, field: 'screenshot', message: 'Upload the payment screenshot first.' })

  // The same answer for an unknown id and a wrong state: nothing about the record leaks.
  const attendee = await getAttendee(passId)
  if (!attendee || (attendee.state !== 'AWAITING_PAYMENT' && attendee.state !== 'REJECTED')) {
    return json(404, { ok: false, message: 'We could not find a registration waiting for a payment with that pass id.' })
  }

  if (!(await screenshotExists(passId, screenshotKey))) {
    return json(400, { ok: false, field: 'screenshot', message: 'The screenshot did not upload. Try it again.' })
  }

  const out = await stepTwo(passId, utr, screenshotKey)
  if (!out.ok) {
    if (out.reason === 'utr-used') {
      return json(409, { ok: false, field: 'utr', reason: 'utr-used', message: 'That UTR has already been submitted for another registration. Check it in your UPI app; each payment has its own.' })
    }
    if (out.reason === 'bad-utr') return json(400, { ok: false, field: 'utr', message: 'A UTR is exactly 12 digits.' })
    return json(409, { ok: false, message: 'This registration is not waiting for a payment.' })
  }

  console.info(`[register] ${passId} pending verification, UTR submitted, email 1 ${out.emailed ? 'sent' : 'not sent'}`)
  return json(200, { ok: true, passId, state: out.attendee.state, verificationWindow: VERIFICATION_WINDOW })
}
