import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '@/lib/db/client'
import { gsi1, keys, normaliseEmail } from '@/lib/db/keys'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'

/** SPEC.md section 7: validate the email on the server, five per IP per hour. */
const LIMIT_PER_HOUR = 5

/**
 * Deliberately not a clever regex. It checks shape only, because the only real
 * proof an address exists is sending to it, and nothing is sent yet.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null)
  const raw = (body as { email?: unknown } | null)?.email

  if (typeof raw !== 'string' || !EMAIL.test(raw.trim()) || raw.trim().length > 254) {
    return json(400, { ok: false, message: 'That does not look like an email address.' })
  }

  const ip = callerIp(req)
  if (!(await withinRateLimit(ip, 'SUB', LIMIT_PER_HOUR))) {
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
