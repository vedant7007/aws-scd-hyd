import { currentCrew } from '@/lib/auth/admin'
import { getCertByPass } from '@/lib/certificates'
import { normalisePassId } from '@/lib/db/keys'
import { presignView } from '@/lib/registration/screenshots'

/** The survey screenshot behind a certificate. Admin only, a 60 second link, like the payment screenshots. */
export async function GET(_req: Request, ctx: RouteContext<'/admin/cert-shot/[passId]'>): Promise<Response> {
  const session = await currentCrew()
  if (session.status !== 'ok' || session.role !== 'admin') return new Response('forbidden', { status: 403, headers: { 'cache-control': 'no-store' } })

  const passId = normalisePassId((await ctx.params).passId)
  const cert = passId ? await getCertByPass(passId) : null
  if (!cert?.screenshotKey) return new Response('no screenshot', { status: 404, headers: { 'cache-control': 'no-store' } })
  return new Response(null, { status: 302, headers: { location: await presignView(cert.screenshotKey), 'cache-control': 'no-store' } })
}
