import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '@/lib/db/client'
import { keys } from '@/lib/db/keys'
import { BOT, istDay, refHost, trackedPath } from '@/lib/traffic'

/**
 * One page view. Posted by the Beacon component with navigator.sendBeacon,
 * which is why the body is read as text: a beacon's content type is whatever
 * the browser chose, and this should not care.
 *
 * Always answers 204, including when it counts nothing. The page has already
 * moved on by the time this lands, and there is no one to tell.
 *
 * ponytail: no rate limit. The path allowlist bounds the keys a caller can
 * reach, so the worst a script can do is inflate a counter. Put a per-IP
 * limit in front of it if the numbers ever need to hold up to scrutiny.
 */

const done = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  if (BOT.test(req.headers.get('user-agent') ?? '')) return done()

  let body: { path?: unknown; ref?: unknown; visit?: unknown }
  try {
    body = JSON.parse(await req.text())
  } catch {
    return done()
  }
  if (typeof body.path !== 'string') return done()

  const day = istDay()
  const path = trackedPath(body.path)
  const visit = body.visit === true ? 1 : 0
  const ref = visit && typeof body.ref === 'string' ? refHost(body.ref) : null

  const bump = (sk: string, views: number, visits: number) =>
    ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: keys.hits(day, sk),
        UpdateExpression: 'ADD #v :v, #s :s',
        ExpressionAttributeNames: { '#v': 'views', '#s': 'visits' },
        ExpressionAttributeValues: { ':v': views, ':s': visits },
      }),
    )

  try {
    await Promise.all([
      bump('TOTAL', 1, visit),
      bump(`PATH#${path}`, 1, visit),
      // Where a visit came from, counted once, on its first page.
      ...(ref ? [bump(`REF#${ref}`, 0, 1)] : []),
    ])
  } catch (err) {
    // A lost page view is not worth failing anything over, but it is worth
    // seeing in the logs if it keeps happening.
    console.error('[hit] not counted', err)
  }
  return done()
}
