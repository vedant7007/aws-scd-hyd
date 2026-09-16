import { timingSafeEqual } from 'node:crypto'
import { getAttendee } from '@/lib/db/queries'

/**
 * What the browser polls after Checkout closes. It reports, it never decides:
 * the only writers of paymentStatus are the webhook and the reconcile run.
 *
 * The checkout token is a bearer handed to the browser that created the
 * record, so knowing a ticket reference, which is printed on every pass and
 * read out at the gate, is not enough to fetch someone else's pass link.
 */
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { ticketRef?: unknown; checkoutToken?: unknown } | null
  const ref = body?.ticketRef
  const token = body?.checkoutToken
  if (typeof ref !== 'string' || typeof token !== 'string' || !ref || !token) {
    return json(400, { ok: false, message: 'ticketRef and checkoutToken are required.' })
  }

  const attendee = await getAttendee(ref)
  // One answer for a wrong token and an unknown reference.
  if (!attendee?.checkoutToken || !same(attendee.checkoutToken, token)) {
    return json(404, { ok: false, message: 'No checkout with that reference.' })
  }

  return json(200, {
    ok: true,
    ticketRef: attendee.ticketRef,
    status: attendee.paymentStatus,
    email: attendee.email,
    // The pass link is minted by the webhook. Until then there is nothing to give.
    passUrl: attendee.paymentStatus === 'paid' && attendee.passToken ? `/pass/${attendee.passToken}` : null,
    confirmationSent: Boolean(attendee.confirmationSentAt),
  })
}
