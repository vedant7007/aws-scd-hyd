import { tierLabel } from '@/content/passes'
import { currentCrew } from '@/lib/auth/admin'
import { listSubscribers } from '@/lib/db/queries'
import { toCsv } from '@/lib/db/stats'
import type { Tier } from '@/lib/db/types'

/**
 * Everyone waiting for registrations to open. Admin only, like every other
 * export: this is a list of real addresses.
 */
export async function GET(): Promise<Response> {
  const session = await currentCrew()
  if (session.status !== 'ok' || session.role !== 'admin') {
    return new Response('Not an admin account.', { status: 403, headers: { 'cache-control': 'no-store' } })
  }

  const subs = await listSubscribers()

  const csv = toCsv([
    ['Email', 'Signed up', 'Source', 'Interested passes'],
    ...subs.map((s) => [
      s.email,
      s.createdAt,
      s.source ?? 'subscribe',
      (s.interestedPasses ?? []).map((t) => tierLabel(t as Tier)).join(' / '),
    ]),
  ])

  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="scd-notify-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
