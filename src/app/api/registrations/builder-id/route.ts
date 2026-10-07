import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { normaliseBuilderId } from '@/content/builder'
import { ddb, tableName } from '@/lib/db/client'
import { keys, normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'

/**
 * Adds or corrects the AWS Builder ID on a registration made before the
 * flow asked for it. The pass id is the key, as it is for the pass page; an
 * unknown id and one that is not a live registration get the same answer.
 */
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  if (!(await withinRateLimit(callerIp(req), 'BUILDER', 40))) {
    return json(429, { ok: false, message: 'Too many tries from this network. Wait a little and try again.' })
  }
  const body = (await req.json().catch(() => null)) as { passId?: unknown; builderId?: unknown } | null
  const passId = typeof body?.passId === 'string' ? normalisePassId(body.passId) : null
  const builderId = typeof body?.builderId === 'string' ? normaliseBuilderId(body.builderId) : null
  if (!passId) return json(400, { ok: false, field: 'pass', message: 'That is not a pass ID. It looks like SCD-XXXXXXXXXX and is in your registration email.' })
  if (!builderId) return json(400, { ok: false, field: 'builder', message: 'That does not look like a Builder ID. Type the @username from Manage profile.' })

  const a = await getAttendee(passId)
  if (!a || a.state === 'AWAITING_PAYMENT' || a.state === 'ABANDONED') {
    return json(404, { ok: false, field: 'pass', message: 'We could not find a registration with that pass ID. Check it against your email.' })
  }
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.attendee(passId),
      UpdateExpression: 'SET builderId = :b, builderIdAt = :at',
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeValues: { ':b': builderId, ':at': new Date().toISOString() },
    }),
  )
  console.info(`[builder-id] ${passId} set`)
  return json(200, { ok: true, builderId })
}
