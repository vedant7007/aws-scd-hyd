import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '@/lib/db/client'
import { gsi1, keys, normaliseEmail } from '@/lib/db/keys'

/**
 * SPEC.md section 7: validate the email on the server and rate limit to five
 * per IP per hour. The limit lives in the table rather than in memory, because
 * Amplify Hosting runs more than one instance and an in memory counter would
 * reset on every cold start.
 */
const LIMIT_PER_HOUR = 5

/**
 * Deliberately not a clever regex. It checks shape only, because the only real
 * proof an address exists is sending to it, and nothing is sent yet.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/** Trusts the leftmost hop of x-forwarded-for, which is what CloudFront sets. */
function callerIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

async function withinRateLimit(ip: string): Promise<boolean> {
  const hourBucket = new Date().toISOString().slice(0, 13)
  // One hour past the bucket, so rows clean themselves up.
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 2

  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `RATE#${ip}`, SK: `SUB#${hourBucket}` },
      UpdateExpression: 'ADD hits :one SET expiresAt = if_not_exists(expiresAt, :exp)',
      ExpressionAttributeValues: { ':one': 1, ':exp': expiresAt },
      ReturnValues: 'UPDATED_NEW',
    }),
  )

  const hits = Number(res.Attributes?.hits ?? 0)
  return hits <= LIMIT_PER_HOUR
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null)
  const raw = (body as { email?: unknown } | null)?.email

  if (typeof raw !== 'string' || !EMAIL.test(raw.trim()) || raw.trim().length > 254) {
    return json(400, { ok: false, message: 'That does not look like an email address.' })
  }

  const ip = callerIp(req)
  if (!(await withinRateLimit(ip))) {
    return json(429, {
      ok: false,
      message: 'That is a lot of sign ups from one connection. Try again in an hour.',
    })
  }

  const email = normaliseEmail(raw)
  const createdAt = new Date().toISOString()

  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: { ...keys.subscriber(email), ...gsi1.subscriberByDate(createdAt), email, createdAt },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    )
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
    // Already subscribed. Same answer either way, so this cannot be used to
    // find out whether an address is on the list.
  }

  return json(200, { ok: true, message: 'You are on the list. We will write when there is news.' })
}
