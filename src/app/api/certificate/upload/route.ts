import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { MAX_SCREENSHOT_BYTES, presignUpload } from '@/lib/registration/screenshots'

/**
 * A one-shot upload URL for the survey screenshot, for a verified pass. Same
 * private bucket as the payment screenshots, under certs/<passId>/.
 */
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { passId?: unknown; contentType?: unknown; bytes?: unknown } | null
  const passId = typeof body?.passId === 'string' ? normalisePassId(body.passId) : null
  if (!passId) return json(400, { ok: false, field: 'passId', message: 'Enter the pass ID from your ticket, like SCD-K4M7PQR29T.' })
  // A whole college on one wifi address claims at once.
  if (!(await withinRateLimit(callerIp(req), 'CERTUP', 600))) return json(429, { ok: false, message: 'Too many tries from this connection. Try again in an hour.' })

  const attendee = await getAttendee(passId)
  if (!attendee || attendee.state !== 'VERIFIED') return json(404, { ok: false, field: 'passId', message: 'We cannot find that pass. Check the pass ID on your ticket email.' })

  const grant = await presignUpload(passId, typeof body?.contentType === 'string' ? body.contentType : '', typeof body?.bytes === 'number' ? body.bytes : 0, 'certs')
  if ('error' in grant) return json(400, { ok: false, field: 'shot', message: grant.error, maxBytes: MAX_SCREENSHOT_BYTES })
  return json(200, { ok: true, ...grant })
}
