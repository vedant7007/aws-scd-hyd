import { sessionsAllowedFor } from '@/content/passes'
import { getAttendeeByToken, getAttendeeWithSelections, getSessionsInSlot } from '@/lib/db/queries'
import type { SeatCount, Session } from '@/lib/db/types'
import { claimSeat, getSelection } from '@/lib/db/seats'

const counts = (sessions: Session[]): SeatCount[] =>
  sessions.map((s) => ({ sessionId: s.sessionId, seatsTaken: s.seatsTaken, capacity: s.capacity }))

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * Claims one seat for one slot. The pass token in the path is the only
 * credential, which is the whole point of SPEC.md section 1: there is no login.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<'/api/pass/[token]/sessions'>,
): Promise<Response> {
  const { token } = await ctx.params

  const attendee = await getAttendeeByToken(token)
  if (!attendee) {
    return json(404, { ok: false, code: 'invalid-token', message: 'This pass link is not valid.' })
  }
  if (attendee.paymentStatus !== 'paid') {
    return json(403, {
      ok: false,
      code: 'not-paid',
      message: 'This pass is no longer active. Write to us if that looks wrong.',
    })
  }

  const body: unknown = await req.json().catch(() => null)
  const slotId = (body as { slotId?: unknown } | null)?.slotId
  const sessionId = (body as { sessionId?: unknown } | null)?.sessionId
  if (typeof slotId !== 'string' || typeof sessionId !== 'string') {
    return json(400, { ok: false, code: 'bad-request', message: 'Pick a session in a slot.' })
  }

  const sessions = await getSessionsInSlot(slotId)
  if (!sessions.some((s) => s.sessionId === sessionId)) {
    return json(400, {
      ok: false,
      code: 'bad-request',
      message: 'That session is not running in that slot.',
      sessions: counts(sessions),
    })
  }

  const previousSessionId = (await getSelection(attendee.ticketRef, slotId))?.sessionId ?? null

  // Tier allowance only bites when they are filling a slot they had left empty.
  // Swapping within a slot they already hold never changes the total.
  const allowance = sessionsAllowedFor(attendee.tier)
  if (allowance !== null && previousSessionId === null) {
    const { selections } = await getAttendeeWithSelections(attendee.ticketRef)
    if (selections.length >= allowance) {
      return json(409, {
        ok: false,
        code: 'allowance',
        message: `Your ${attendee.tier} pass covers ${allowance} session${allowance === 1 ? '' : 's'}. Release one first.`,
        sessions: counts(sessions),
      })
    }
  }

  const outcome = await claimSeat({
    ticketRef: attendee.ticketRef,
    slotId,
    newSessionId: sessionId,
    previousSessionId,
  })

  // Always hand back fresh counts, so a refusal updates the screen rather than
  // leaving stale numbers next to an error.
  const refreshed = counts(await getSessionsInSlot(slotId))

  if (!outcome.ok) {
    const message =
      outcome.reason === 'full'
        ? 'That seat just went. Someone took the last one while you were deciding.'
        : 'This slot changed in another tab. The latest is shown now, try again.'
    return json(409, { ok: false, code: outcome.reason, message, sessions: refreshed })
  }

  return json(200, { ok: true, slotId, sessionId, sessions: refreshed })
}
