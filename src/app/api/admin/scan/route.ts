import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { currentCrew } from '@/lib/auth/admin'
import { ddb, tableName } from '@/lib/db/client'
import { keys, normalisePassId } from '@/lib/db/keys'
import type { Attendee } from '@/lib/db/types'
import { programSession } from '@/content/program'

export type ScanAction = 'lookup' | 'checkin' | 'swag' | 'undo'

export type ScanResult = {
  ok: boolean
  passId: string
  /** Set when the pass exists. */
  attendee?: GateCard
  checkedInAt?: string
  swagIssuedAt?: string
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
}

const summarise = (a: Attendee): GateCard => ({
  name: a.name,
  tier: a.tier,
  college: a.college,
  technical: programSession(a.technicalSession)?.title ?? a.technicalSession,
  workshop: a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : null,
  builderId: a.builderId ?? null,
  group: a.groupId ? { size: a.groupSize ?? 0, payer: a.groupId === a.passId } : null,
})

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

  const ref = typeof typed === 'string' ? normalisePassId(typed) : null
  if (!ref) {
    return json(400, { ok: false, message: 'That is not a pass id.' })
  }
  if (action !== 'lookup' && action !== 'checkin' && action !== 'swag' && action !== 'undo') {
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
      checkedInAt: attendee.checkedInAt,
      swagIssuedAt: attendee.swagIssuedAt,
    })
  }

  // A check in made by mistake, undone from the same screen. Swag stays as it was.
  if (action === 'undo') {
    await ddb.send(new UpdateCommand({ TableName: table, Key: keys.attendee(ref), UpdateExpression: 'REMOVE checkedInAt' }))
    console.info(`[scan] ${ref} check in undone by ${session.email}`)
    return json(200, { ok: true, passId: ref, attendee: summarise(attendee), swagIssuedAt: attendee.swagIssuedAt, message: 'Check in undone.' })
  }

  const field = action === 'checkin' ? 'checkedInAt' : 'swagIssuedAt'
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
      checkedInAt: attendee.checkedInAt,
      swagIssuedAt: attendee.swagIssuedAt,
      message:
        action === 'checkin'
          ? `Already checked in at ${attendee.checkedInAt}.`
          : `Swag already issued at ${attendee.swagIssuedAt}.`,
    })
  }

  return json(200, {
    ok: true,
    repeat: false,
    passId: ref,
    attendee: summarise(attendee),
    checkedInAt: action === 'checkin' ? now : attendee.checkedInAt,
    swagIssuedAt: action === 'swag' ? now : attendee.swagIssuedAt,
  })
}
