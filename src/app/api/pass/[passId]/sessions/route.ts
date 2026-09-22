import { sessionRefinementOpen } from '@/content/event'
import { getAttendeeByToken, getAttendeeWithSeats, getConfig, getSessionsInSlot } from '@/lib/db/queries'
import { refineSlot } from '@/lib/db/seats'
import type { SeatCount, Session } from '@/lib/db/types'

const counts = (sessions: Session[]): SeatCount[] =>
  sessions.map((s) => ({ sessionId: s.sessionId, seatsTaken: s.seatsTaken, sellableCapacity: s.sellableCapacity }))

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * SHIPS LATER. Narrows one slot to one session within the tracks the pass
 * holds, releasing the seats held in the other tracks for that slot. Behind
 * sessionRefinementOpen (content, or the config item) and refused while it is
 * off. The pass token in the path is the only credential, which is the whole
 * point of SPEC.md section 1: there is no login.
 *
 * Refining never claims a seat, so it cannot fail on capacity, and a Regular
 * pass, holding one track, has nothing to narrow.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/pass/[token]/sessions'>): Promise<Response> {
  const { token } = await ctx.params

  const config = await getConfig()
  if (!(config?.sessionRefinementOpen ?? sessionRefinementOpen)) {
    return json(403, { ok: false, code: 'not-open', message: 'Session choices open once the line-up is announced.' })
  }

  const attendee = await getAttendeeByToken(token)
  if (!attendee) return json(404, { ok: false, code: 'invalid-token', message: 'This pass link is not valid.' })
  if (attendee.paymentStatus !== 'paid') {
    return json(403, { ok: false, code: 'not-paid', message: 'This pass is no longer active. Write to us if that looks wrong.' })
  }

  const body: unknown = await req.json().catch(() => null)
  const slotId = (body as { slotId?: unknown } | null)?.slotId
  const sessionId = (body as { sessionId?: unknown } | null)?.sessionId
  if (typeof slotId !== 'string' || typeof sessionId !== 'string') {
    return json(400, { ok: false, code: 'bad-request', message: 'Pick a session in a slot.' })
  }

  const { seats } = await getAttendeeWithSeats(attendee.ticketRef)
  const outcome = await refineSlot(attendee.ticketRef, slotId, sessionId, seats)

  // Always hand back fresh counts, so a refusal updates the screen rather than
  // leaving stale numbers next to an error.
  const refreshed = counts(await getSessionsInSlot(slotId))

  if (!outcome.ok) {
    const message =
      outcome.reason === 'not-held'
        ? 'That session is not in a track your pass covers.'
        : 'This slot changed in another tab. The latest is shown now, try again.'
    return json(409, { ok: false, code: outcome.reason, message, sessions: refreshed })
  }

  return json(200, { ok: true, slotId, sessionId, released: outcome.released, sessions: refreshed })
}
