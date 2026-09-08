import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { currentAdmin } from '@/lib/auth/admin'
import { ddb, tableName } from '@/lib/db/client'
import { keys } from '@/lib/db/keys'
import type { Attendee } from '@/lib/db/types'

export type ScanAction = 'lookup' | 'checkin' | 'swag'

export type ScanResult = {
  ok: boolean
  ticketRef: string
  /** Set when the ticket exists. */
  attendee?: { name: string; tier: string; foodPreference: string; college: string }
  checkedInAt?: string
  swagIssuedAt?: string
  /** True when this exact action had already been done before this scan. */
  repeat?: boolean
  message?: string
}

const json = (status: number, body: ScanResult | { ok: false; message: string }) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

const summarise = (a: Attendee) => ({
  name: a.name,
  tier: a.tier,
  foodPreference: a.foodPreference,
  college: a.college,
})

/**
 * One endpoint for the gate. Marking is conditional, so a second scan of the
 * same badge reports that it was already done instead of silently succeeding
 * and hiding a duplicate entry.
 */
export async function POST(req: Request): Promise<Response> {
  // API, so a refusal is a status code rather than a redirect.
  const session = await currentAdmin()
  if (session.status !== 'ok') {
    return json(403, { ok: false, message: 'Not an organiser account.' })
  }

  const body: unknown = await req.json().catch(() => null)
  const ticketRef = (body as { ticketRef?: unknown } | null)?.ticketRef
  const action = (body as { action?: unknown } | null)?.action

  if (typeof ticketRef !== 'string' || !ticketRef.trim()) {
    return json(400, { ok: false, message: 'No ticket reference in that scan.' })
  }
  if (action !== 'lookup' && action !== 'checkin' && action !== 'swag') {
    return json(400, { ok: false, message: 'Unknown action.' })
  }

  const table = tableName()
  const ref = ticketRef.trim()

  const existing = await ddb.send(new GetCommand({ TableName: table, Key: keys.attendee(ref) }))
  const attendee = existing.Item as Attendee | undefined

  if (!attendee) {
    return json(404, { ok: false, ticketRef: ref, message: 'No ticket with that reference.' })
  }

  if (attendee.paymentStatus !== 'paid') {
    return json(200, {
      ok: false,
      ticketRef: ref,
      attendee: summarise(attendee),
      message: `This pass is ${attendee.paymentStatus}. Do not let them through without checking.`,
    })
  }

  if (action === 'lookup') {
    return json(200, {
      ok: true,
      ticketRef: ref,
      attendee: summarise(attendee),
      checkedInAt: attendee.checkedInAt,
      swagIssuedAt: attendee.swagIssuedAt,
    })
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
      ticketRef: ref,
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
    ticketRef: ref,
    attendee: summarise(attendee),
    checkedInAt: action === 'checkin' ? now : attendee.checkedInAt,
    swagIssuedAt: action === 'swag' ? now : attendee.swagIssuedAt,
  })
}
