import QRCode from 'qrcode'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'

/**
 * The ticket QR as a PNG, for email 2: mail clients will not show SVG.
 * Only a VERIFIED pass has one; anything else is the same bare 404 as the
 * pass page, so the route cannot be used to probe ids.
 */
export async function GET(_req: Request, { params }: RouteContext<'/api/pass/[passId]/qr'>): Promise<Response> {
  const passId = normalisePassId((await params).passId)
  const a = passId ? await getAttendee(passId) : null
  if (!a || a.state !== 'VERIFIED') return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  const png = await QRCode.toBuffer(a.passId, { errorCorrectionLevel: 'M', scale: 10, margin: 4 })
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=86400' } })
}
