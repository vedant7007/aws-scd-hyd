import { normaliseCode } from '@/lib/referral/codes'

/**
 * The share link: awsscdhyd.in/r/VEDANT26 lands on registration with the code
 * filled in. A malformed code still lands on registration, just without one;
 * whether the code is real is checked on the form, where the person can see it.
 */
export async function GET(req: Request, { params }: RouteContext<'/r/[code]'>): Promise<Response> {
  const code = normaliseCode((await params).code)
  const to = new URL(code ? `/register?ref=${code}` : '/register', req.url)
  return Response.redirect(to, 307)
}
