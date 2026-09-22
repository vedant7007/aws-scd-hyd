import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { MAX_SCREENSHOT_BYTES, presignUpload } from '@/lib/registration/screenshots'

/**
 * A one-shot upload URL for the UPI screenshot, for a pass that is waiting
 * for a payment. The browser PUTs the file straight to the private bucket;
 * the server never sees the bytes and nothing but an admin ever reads them.
 */
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { passId?: unknown; contentType?: unknown; bytes?: unknown } | null
  const passId = typeof body?.passId === 'string' ? normalisePassId(body.passId) : null
  const contentType = typeof body?.contentType === 'string' ? body.contentType : ''
  const bytes = typeof body?.bytes === 'number' ? body.bytes : 0
  if (!passId) return json(400, { ok: false, message: 'That is not a pass id.' })

  const attendee = await getAttendee(passId)
  if (!attendee || (attendee.state !== 'AWAITING_PAYMENT' && attendee.state !== 'REJECTED')) {
    return json(404, { ok: false, message: 'We could not find a registration waiting for a payment with that pass id.' })
  }

  const grant = await presignUpload(passId, contentType, bytes)
  if ('error' in grant) return json(400, { ok: false, message: grant.error, maxBytes: MAX_SCREENSHOT_BYTES })
  return json(200, { ok: true, ...grant })
}
