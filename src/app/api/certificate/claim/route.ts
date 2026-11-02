import { normaliseSurveyId } from '@/content/certificate'
import { claimCertificate, mailCertificate } from '@/lib/certificates'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { isReservedAddress } from '@/lib/email/send'
import { screenshotExists } from '@/lib/registration/screenshots'

/**
 * Earn the certificate: pass ID, the name to print, the AWS survey
 * submission ID and the screenshot already uploaded. Every check is here;
 * lib/certificates decides issued or held.
 */
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const str = (k: string) => (typeof b?.[k] === 'string' ? (b[k] as string).trim() : '')

  const passId = normalisePassId(str('passId'))
  if (!passId) return json(400, { ok: false, field: 'passId', message: 'Enter the pass ID from your ticket, like SCD-K4M7PQR29T.' })
  const certName = str('certName').replace(/\s+/g, ' ')
  if (certName.length < 2 || certName.length > 60) return json(400, { ok: false, field: 'certName', message: 'Type your name as it should read on the certificate, up to 60 letters.' })
  const surveyId = normaliseSurveyId(str('surveyId'))
  if (!surveyId) return json(400, { ok: false, field: 'surveyId', message: 'Copy the ID from the survey\'s My Submissions page. It starts with SurveySubmission-.' })

  if (!(await withinRateLimit(callerIp(req), 'CERT', 600))) return json(429, { ok: false, message: 'Too many tries from this connection. Try again in an hour.' })

  const attendee = await getAttendee(passId)
  if (!attendee || attendee.state !== 'VERIFIED') return json(404, { ok: false, field: 'passId', message: 'We cannot find that pass. Check the pass ID on your ticket email.' })
  const screenshotKey = str('screenshotKey')
  if (!(await screenshotExists(passId, screenshotKey, 'certs'))) return json(400, { ok: false, field: 'shot', message: 'Add the screenshot of your survey submission.' })

  const res = await claimCertificate({ passId, name: attendee.name, email: attendee.email, certName, surveyId, screenshotKey })
  if ('error' in res) return json(409, { ok: false, field: 'surveyId', message: res.error })

  if (res.fresh && res.cert.state === 'ISSUED' && !isReservedAddress(res.cert.email)) {
    // The certificate is on the page already; a failed mail loses nothing.
    await mailCertificate(res.cert).catch((err) => console.error(`[cert] mail for ${res.cert.certId} failed`, err))
  }
  return json(200, { ok: true, state: res.cert.state, certId: res.cert.certId })
}
