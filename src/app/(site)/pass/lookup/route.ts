import { normalisePassId } from '@/lib/db/keys'
import { getAttendeeByPass } from '@/lib/db/queries'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'

/**
 * Amendment 2 section 2. The pass id entry form posts here.
 *
 * VERIFIED and SESSIONS_SELECTED redirect to the pass. Everything else,
 * an unknown id, a mistyped one, AWAITING_PAYMENT, PENDING_VERIFICATION,
 * REJECTED, ABANDONED, gets the one same redirect, built by the one same
 * line, so the response is byte for byte identical and the page cannot be
 * used to learn which ids exist or what state they are in.
 *
 * Throttle: failed lookups only, counted per IP against a high ceiling.
 * Students share NATed campus addresses, hundreds behind one IP, so a
 * tight limit would lock out a whole college for one person's typos. 300
 * failures an hour from one address is far beyond honest mistyping (a
 * person retries a handful of times) and far below what an enumeration of
 * a 49 bit space would need, which is the only thing the limit is for.
 * Successful lookups are never counted.
 */
const FAILED_LOOKUPS_PER_IP_PER_HOUR = 300

const notFound = (origin: string) =>
  new Response(null, { status: 303, headers: { location: `${origin}/pass?notfound=1`, 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin
  const form = await req.formData().catch(() => null)
  const typed = String(form?.get('passId') ?? '')
  const passId = normalisePassId(typed)

  const attendee = passId ? await getAttendeeByPass(passId) : null
  if (attendee && (attendee.state === 'VERIFIED' || attendee.state === 'SESSIONS_SELECTED')) {
    return new Response(null, { status: 303, headers: { location: `${origin}/pass/${attendee.passId}`, 'cache-control': 'no-store' } })
  }

  if (!(await withinRateLimit(callerIp(req), 'LOOKUP', FAILED_LOOKUPS_PER_IP_PER_HOUR))) {
    return new Response('Too many attempts from this network. Try again in an hour.', {
      status: 429,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '3600' },
    })
  }
  return notFound(origin)
}
