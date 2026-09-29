import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { NextResponse } from 'next/server'
import { ddb, tableName } from '@/lib/db/client'
import { keys } from '@/lib/db/keys'

/**
 * The kill switch. While the config item says siteOffline, every request
 * (admin included) gets a bare 503, the site looking down. It is flipped
 * with `npm run site -- off|on` against the production table, not from the
 * admin, which would be down with everything else.
 *
 * Read at most every five seconds per server instance, so it costs next to
 * nothing and takes effect within seconds. Fails open: if the read errors,
 * the site stays up.
 */
let cached: { offline: boolean; at: number } | null = null

async function offline(): Promise<boolean> {
  if (cached && Date.now() - cached.at < 5000) return cached.offline
  try {
    const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.config(), ProjectionExpression: 'siteOffline' }))
    cached = { offline: res.Item?.siteOffline === true, at: Date.now() }
  } catch {
    cached = { offline: false, at: Date.now() }
  }
  return cached.offline
}

export async function proxy() {
  if (!(await offline())) return NextResponse.next()
  return new NextResponse('Service Unavailable', { status: 503, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store', 'retry-after': '600' } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
}
