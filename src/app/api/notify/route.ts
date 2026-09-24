import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { passes } from '@/content/passes'
import { ddb, tableName } from '@/lib/db/client'
import { gsi1, keys, normaliseEmail } from '@/lib/db/keys'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'

/**
 * The notify list. While REGISTRATION_OPEN is false this is the only thing
 * the site collects: an address, and optionally which passes someone had
 * their eye on. Same store as /api/subscribe, so one export covers both.
 */

const LIMIT_PER_HOUR = 10

/** Shape only. The only proof an address exists is writing to it. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const TIERS = new Set(passes.map((p) => p.id as string))

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; interestedPasses?: unknown; company?: unknown }
    | null

  // The honeypot. A person never sees the field, so anything in it is a bot.
  // Answered 200 on purpose: a bot told it failed just tries again.
  if (typeof body?.company === 'string' && body.company.trim() !== '') {
    return json(200, { ok: true, message: 'You are on the list.' })
  }

  const raw = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!EMAIL.test(raw) || raw.length > 254) {
    return json(400, { ok: false, message: 'That does not look like an email address.' })
  }

  const ip = callerIp(req)
  if (!(await withinRateLimit(ip, 'NOTIFY', LIMIT_PER_HOUR))) {
    return json(429, {
      ok: false,
      message: 'That is a lot of sign ups from one connection. Try again in an hour.',
    })
  }

  const interestedPasses = Array.isArray(body?.interestedPasses)
    ? [...new Set(body.interestedPasses.filter((t): t is string => typeof t === 'string' && TIERS.has(t)))]
    : []

  const email = normaliseEmail(raw)
  const createdAt = new Date().toISOString()

  // An update rather than a conditional put: a second sign up is not an error,
  // it is someone changing their mind about which pass they want. createdAt
  // and the GSI sort key keep the first date so the list stays in order.
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.subscriber(email),
      UpdateExpression:
        'SET email = :email, createdAt = if_not_exists(createdAt, :now), GSI1PK = :gpk, GSI1SK = if_not_exists(GSI1SK, :now), interestedPasses = :passes, #src = if_not_exists(#src, :source)',
      ExpressionAttributeNames: { '#src': 'source' },
      ExpressionAttributeValues: {
        ':email': email,
        ':now': createdAt,
        ':gpk': gsi1.subscriberByDate(createdAt).GSI1PK,
        ':passes': interestedPasses,
        ':source': 'register-closed',
      },
    }),
  )

  // Same answer whether the address was already there, so this cannot be used
  // to find out who has signed up.
  return json(200, { ok: true, message: 'You are on the list. We will write when registrations open.' })
}
