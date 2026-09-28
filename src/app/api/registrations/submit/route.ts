import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { submitPayment } from '@/lib/registration/flow'
import { screenshotExists } from '@/lib/registration/screenshots'
import { normaliseUtr } from '@/lib/registration/validate'
import { VERIFICATION_WINDOW } from '@/lib/email/templates'

/**
 * The flow's SUBMIT: the UTR and the key of the screenshot the browser just
 * uploaded. Moves AWAITING_PAYMENT (or REJECTED, on a resubmission) to
 * PENDING_VERIFICATION and sends email 1 with the pass id.
 *
 * The UTR is checked here, on the server: letters and digits, 12 to 40. The
 * table, not this code, enforces that a UTR is used once: a second
 * submission of the same UTR from any pass fails the transaction.
 */
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { passId?: unknown; utr?: unknown; screenshotKey?: unknown } | null
  const passId = typeof body?.passId === 'string' ? normalisePassId(body.passId) : null
  const utr = typeof body?.utr === 'string' ? normaliseUtr(body.utr) : null
  const screenshotKey = typeof body?.screenshotKey === 'string' ? body.screenshotKey : ''

  if (!passId) return json(400, { ok: false, field: 'passId', message: 'That is not a pass id.' })
  if (!utr) return json(400, { ok: false, field: 'utr', message: 'A UTR is letters and numbers, at least 12 characters. It is in your UPI app under the payment.' })
  if (!screenshotKey) return json(400, { ok: false, field: 'shot', message: 'Add the screenshot of your UPI receipt.' })

  // The same answer for an unknown id and a wrong state: nothing about the record leaks.
  const attendee = await getAttendee(passId)
  if (!attendee || (attendee.state !== 'AWAITING_PAYMENT' && attendee.state !== 'REJECTED')) {
    return json(404, { ok: false, message: 'We could not find a registration waiting for a payment with that pass id. If your 90 minutes ran out, start again.' })
  }

  if (!(await screenshotExists(passId, screenshotKey))) {
    return json(400, { ok: false, field: 'shot', message: 'The screenshot did not upload. Try it again.' })
  }

  const out = await submitPayment(passId, utr, screenshotKey)
  if (!out.ok) {
    if (out.reason === 'utr-used') {
      return json(409, { ok: false, field: 'utr', message: 'That UTR has already been submitted for another registration. Check it in your UPI app; each payment has its own.' })
    }
    return json(409, { ok: false, message: 'This registration is not waiting for a payment.' })
  }

  console.info(`[submit] ${passId} pending verification, email 1 ${out.emailed ? 'sent' : 'not sent'}`)
  return json(200, { ok: true, passId, state: out.attendee.state, verificationWindow: VERIFICATION_WINDOW })
}
