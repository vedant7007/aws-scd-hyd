import { normalisePassId } from '@/lib/db/keys'
import { getAllSessions, getAttendee } from '@/lib/db/queries'
import type { SeatCount } from '@/lib/db/types'
import { chooseSessions, sessionsAreReleased, validatePicks, type PickInput } from '@/lib/registration/flow'

const counts = (): Promise<SeatCount[]> =>
  getAllSessions().then((all) =>
    all.flatMap((s) => (s ? [{ sessionId: s.sessionId, seatsTaken: s.seatsTaken, sellableCapacity: s.sellableCapacity }] : [])),
  )

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * Amendment 2 sections 3 and 4. All four picks at once. Validated here
 * against the slots, the sessions and the tier's track allowance from
 * passes.ts, whatever the UI did; then claimed in one transaction. A 409
 * names the session that filled and carries fresh counts so the picker can
 * re-render with the other choices kept. Never a 500 for a full session,
 * never a partial claim.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/pass/[passId]/sessions'>): Promise<Response> {
  const { passId: raw } = await ctx.params
  const passId = normalisePassId(raw)
  const attendee = passId ? await getAttendee(passId) : null
  // Same answer for unknown and for any state that has no picker.
  if (!attendee || attendee.state !== 'VERIFIED') {
    return json(404, { ok: false, message: 'We could not find a pass waiting for session choices with that pass ID.' })
  }
  if (!(await sessionsAreReleased())) return json(403, { ok: false, message: 'Sessions are not open for choosing yet.' })

  const body = (await req.json().catch(() => null)) as { picks?: unknown } | null
  const input = body?.picks
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return json(400, { ok: false, message: 'Send your picks as an object keyed by slot.' })
  const clean: PickInput = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) if (typeof v === 'string') clean[k] = v

  const v = validatePicks(attendee, clean)
  if (!v.ok) return json(400, { ok: false, field: v.field, message: v.message, sessions: await counts() })

  const out = await chooseSessions(attendee.passId, v.picks)
  if (!out.ok) {
    if (out.reason === 'filled') {
      return json(409, { ok: false, filled: out.sessionId, message: 'That session just filled up, please pick another.', sessions: await counts() })
    }
    // Already selected, most likely a second tab. Nothing was claimed.
    return json(409, { ok: false, message: 'Your sessions are already saved. Open your pass to see them.', sessions: await counts() })
  }

  console.info(`[sessions] ${attendee.passId} selected ${v.picks.map((p) => p.sessionId).join(',')}, email 4 ${out.emailed ? 'sent' : 'not sent'}`)
  return json(200, { ok: true, passUrl: `/pass/${attendee.passId}` })
}
