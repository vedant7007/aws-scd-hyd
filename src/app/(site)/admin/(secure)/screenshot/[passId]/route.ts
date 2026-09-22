import { currentAdmin } from '@/lib/auth/admin'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { presignView } from '@/lib/registration/screenshots'

/**
 * Amendment 1 section 7. The only way a screenshot leaves the bucket: an
 * admin, resolved here, gets a 60 second presigned URL and is sent to it.
 * Anyone else gets a bare 403 that names nothing. No attendee field of any
 * kind is in either response.
 */
export async function GET(_req: Request, ctx: RouteContext<'/admin/screenshot/[passId]'>): Promise<Response> {
  const session = await currentAdmin()
  if (session.status !== 'ok') return new Response('forbidden', { status: 403, headers: { 'cache-control': 'no-store' } })

  const { passId: raw } = await ctx.params
  const passId = normalisePassId(raw)
  const attendee = passId ? await getAttendee(passId) : null
  if (!attendee?.screenshotKey) return new Response('no screenshot', { status: 404, headers: { 'cache-control': 'no-store' } })

  const url = await presignView(attendee.screenshotKey)
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store' } })
}
