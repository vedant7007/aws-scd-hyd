import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { currentCrew } from '@/lib/auth/admin'
import { ddb, tableName } from '@/lib/db/client'
import { keys, normalisePassId } from '@/lib/db/keys'
import type { Attendee } from '@/lib/db/types'
import { programSession } from '@/content/program'
import { FOOD, busLabel } from '@/content/transport'

export type ScanAction = 'lookup' | 'checkin' | 'swag' | 'lunch' | 'snack' | 'undo'

/** What each marking action writes. Undo takes one of these as `what`, check in by default. */
const FIELD = { checkin: 'checkedInAt', swag: 'swagIssuedAt', lunch: 'lunchAt', snack: 'snackAt' } as const
type Marked = keyof typeof FIELD
const DONE: Record<Marked, string> = { checkin: 'Already checked in', swag: 'Swag already given', lunch: 'Lunch token already given', snack: 'Light food already given' }

export type ScanResult = {
  ok: boolean
  passId: string
  /** Set when the pass exists. */
  attendee?: GateCard
  checkedInAt?: string
  swagIssuedAt?: string
  lunchAt?: string
  snackAt?: string
  /** True when this exact action had already been done before this scan. */
  repeat?: boolean
  message?: string
}

const json = (status: number, body: ScanResult | { ok: false; message: string }) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/** Everything the gate shows about a person. No email and no phone: the gate identifies, it does not contact. */
export type GateCard = {
  name: string
  tier: string
  college: string
  technical: string
  workshop: string | null
  builderId: string | null
  /** In a group: its size, and whether this person paid for it. */
  group: { size: number; payer: boolean } | null
  /** Their own answers on the ticket page, null until given. */
  food: string | null
  bus: string | null
  busStop: string | null
}

const summarise = (a: Attendee): GateCard => ({
  name: a.name,
  tier: a.tier,
  college: a.college,
  technical: programSession(a.technicalSession)?.title ?? a.technicalSession,
  workshop: a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : null,
  builderId: a.builderId ?? null,
  group: a.groupId ? { size: a.groupSize ?? 0, payer: a.groupId === a.passId } : null,
  food: a.food ? FOOD[a.food] : null,
  bus: busLabel(a.busRoute),
  busStop: a.busStop ?? null,
})

/** Every timestamp the gate shows, from a record. */
const marks = (a: Attendee) => ({ checkedInAt: a.checkedInAt, swagIssuedAt: a.swagIssuedAt, lunchAt: a.lunchAt, snackAt: a.snackAt })

/**
 * One endpoint for the gate. Marking is conditional, so a second scan of the
 * same badge reports that it was already done instead of silently succeeding
 * and hiding a duplicate entry.
 */
export async function POST(req: Request): Promise<Response> {
  // API, so a refusal is a status code rather than a redirect.
  // Any crew role: the scanner is what a volunteer is for.
  const session = await currentCrew()
  if (session.status !== 'ok') {
    return json(403, { ok: false, message: 'Not a crew account.' })
  }

  const body: unknown = await req.json().catch(() => null)
  const typed = (body as { passId?: unknown } | null)?.passId
  const action = (body as { action?: unknown } | null)?.action
  const what = (body as { what?: unknown } | null)?.what ?? 'checkin'

  const ref = typeof typed === 'string' ? normalisePassId(typed) : null
  if (!ref) {
    return json(400, { ok: false, message: 'That is not a pass id.' })
  }
  if (action !== 'lookup' && action !== 'undo' && !(typeof action === 'string' && action in FIELD)) {
    return json(400, { ok: false, message: 'Unknown action.' })
  }

  const table = tableName()

  const existing = await ddb.send(new GetCommand({ TableName: table, Key: keys.attendee(ref) }))
  const attendee = existing.Item as Attendee | undefined

  if (!attendee) {
    return json(404, { ok: false, passId: ref, message: 'No pass with that id.' })
  }

  // Only a verified pass gets through. Sessions were chosen at registration,
  // so a verified pass is complete; anything else is told apart by its state,
  // because a volunteer at 9am cannot debug a generic error.
  if (attendee.state !== 'VERIFIED') {
    return json(200, {
      ok: false,
      passId: ref,
      attendee: summarise(attendee),
      message: `This pass is ${attendee.state.replace('_', ' ').toLowerCase()}. Do not let them through without checking.`,
    })
  }

  if (action === 'lookup') {
    return json(200, {
      ok: true,
      passId: ref,
      attendee: summarise(attendee),
      ...marks(attendee),
    })
  }

  // A mark made by mistake, undone from the same screen. Only that one mark changes.
  if (action === 'undo') {
    if (typeof what !== 'string' || !(what in FIELD)) return json(400, { ok: false, message: 'Unknown undo.' })
    const f = FIELD[what as Marked]
    await ddb.send(new UpdateCommand({ TableName: table, Key: keys.attendee(ref), UpdateExpression: 'REMOVE #f', ExpressionAttributeNames: { '#f': f } }))
    console.info(`[scan] ${ref} ${what} undone by ${session.email}`)
    return json(200, { ok: true, passId: ref, attendee: summarise(attendee), ...marks(attendee), [f]: undefined, message: 'Undone.' })
  }

  const field = FIELD[action as Marked]
  const now = new Date().toISOString()

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: keys.attendee(ref),
        UpdateExpression: 'SET #f = :now',
        // Only the first scan writes. A repeat is reported, not hidden.
        ConditionExpression: 'attribute_not_exists(#f)',
        ExpressionAttributeNames: { '#f': field },
        ExpressionAttributeValues: { ':now': now },
      }),
    )
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
    return json(200, {
      ok: true,
      repeat: true,
      passId: ref,
      attendee: summarise(attendee),
      ...marks(attendee),
      message: `${DONE[action as Marked]} at ${new Date(attendee[field] ?? now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.`,
    })
  }

  return json(200, {
    ok: true,
    repeat: false,
    passId: ref,
    attendee: summarise(attendee),
    ...marks(attendee),
    [field]: now,
  })
}
