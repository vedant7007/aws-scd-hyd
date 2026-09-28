import { tierLabel } from '@/content/passes'
import { programSession } from '@/content/program'
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
    ['Pass ID', 'Name', 'Email', 'College', 'Tier', 'Technical session', 'Workshop', 'Food'],
    // Verified only, and never a preview record: nobody caters for a test.
    ...d.attendees
      .filter((a) => a.state === 'VERIFIED' && a.source !== 'preview')
      .map((a) => [
        a.passId,
        a.name,
        a.email,
        a.college,
        tierLabel(a.tier),
        programSession(a.technicalSession)?.title ?? a.technicalSession,
        a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : '',
        a.foodPreference,
      ]),
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
