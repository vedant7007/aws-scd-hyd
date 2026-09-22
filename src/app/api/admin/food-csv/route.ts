import { tierLabel } from '@/content/passes'
import { trackName } from '@/content/sessions'
import { currentCrew } from '@/lib/auth/admin'
import { loadDashboard, toCsv } from '@/lib/db/stats'

/**
 * The caterer's number. Gated by the same allowlist as the dashboard, because
 * this is the whole attendee roster with names and emails in it.
 */
export async function GET(): Promise<Response> {
  // Admin only. The roster with names and emails never reaches a volunteer.
  const session = await currentCrew()
  if (session.status !== 'ok' || session.role !== 'admin') {
    return new Response('Not an admin account.', { status: 403, headers: { 'cache-control': 'no-store' } })
  }

  const d = await loadDashboard()

  const csv = toCsv([
    ['Food preference', 'Count'],
    ...d.byFood.map((f) => [f.food, f.count]),
    [],
    ['Total paid attendees', d.paid],
    [],
    ['Pass ID', 'Name', 'Email', 'College', 'Tier', 'Track', 'Food', 'State'],
    ...d.attendees
      .filter((a) => a.state === 'VERIFIED' || a.state === 'SESSIONS_SELECTED')
      .map((a) => [a.passId, a.name, a.email, a.college, tierLabel(a.tier), trackName(a.homeTrack), a.foodPreference, a.state]),
  ])

  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="scd-food-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
