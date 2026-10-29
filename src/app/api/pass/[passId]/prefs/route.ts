import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BUS_ROUTES, OWN_TRANSPORT } from '@/content/transport'
import { ddb, tableName } from '@/lib/db/client'
import { keys, normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'

const json = (status: number, body: { ok: boolean; message?: string }) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * Food and college bus, chosen on the ticket page. The pass id is the key,
 * as it is for the ticket itself; only a verified pass takes an answer, and
 * it can be changed until the day.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/pass/[passId]/prefs'>): Promise<Response> {
  if (!(await withinRateLimit(callerIp(req), 'PREFS', 3000))) return json(429, { ok: false, message: 'Too many tries. Wait a minute and try again.' })
  const ref = normalisePassId((await ctx.params).passId)
  if (!ref) return json(400, { ok: false, message: 'Not a pass id.' })

  const body = (await req.json().catch(() => null)) as { food?: unknown; busRoute?: unknown; busStop?: unknown } | null
  const food = body?.food
  const busRoute = body?.busRoute
  const busStop = typeof body?.busStop === 'string' ? body.busStop.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
  if (food !== 'veg' && food !== 'nonveg') return json(400, { ok: false, message: 'Pick veg or non-veg.' })
  const onBus = typeof busRoute === 'string' && BUS_ROUTES.some((r) => r.no === busRoute)
  if (!onBus && busRoute !== OWN_TRANSPORT) return json(400, { ok: false, message: 'Pick a bus route, or own transport.' })
  if (onBus && busStop.length < 2) return json(400, { ok: false, message: 'Type the stop you will board at.' })

  const a = await getAttendee(ref)
  if (!a || a.state !== 'VERIFIED') return json(404, { ok: false, message: 'No ticket with that pass id.' })

  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.attendee(ref),
      UpdateExpression: onBus ? 'SET food = :f, busRoute = :r, busStop = :s, prefsAt = :t' : 'SET food = :f, busRoute = :r, prefsAt = :t REMOVE busStop',
      ConditionExpression: '#st = :v',
      ExpressionAttributeNames: { '#st': 'state' },
      ExpressionAttributeValues: { ':f': food, ':r': busRoute, ':t': new Date().toISOString(), ':v': 'VERIFIED', ...(onBus ? { ':s': busStop } : {}) },
    }),
  )
  return json(200, { ok: true })
}
