import { normaliseCode } from '@/lib/referral/codes'
import { absolute } from '@/lib/site'

/**
 * The share link: awsscdhyd.in/r/VEDANT26 lands on registration with the code
 * filled in. A malformed code still lands on registration, just without one;
 * whether the code is real is checked on the form, where the person can see it.
 * The target is built from the site's own address, never req.url: behind
 * Amplify that is the server's internal host.
 */
export async function GET(_req: Request, { params }: RouteContext<'/r/[code]'>): Promise<Response> {
  const code = normaliseCode((await params).code)
  return Response.redirect(absolute(code ? `/register?ref=${code}` : '/register'), 307)
}
