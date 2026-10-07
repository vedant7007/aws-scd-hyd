import { tierLabel } from '@/content/passes'
import { programSession } from '@/content/program'
import { currentCrew } from '@/lib/auth/admin'
import { loadDashboard, toCsv } from '@/lib/db/stats'

/**
 * Everyone coming: the lunch headcount and the roster. Admin only, because
 * this is the whole attendee list with names and emails in it.
 */
export async function GET(): Promise<Response> {
  // Admin only. The roster with names and emails never reaches a volunteer.
  const session = await currentCrew()
  if (session.status !== 'ok' || session.role !== 'admin') {
    return new Response('Not an admin account.', { status: 403, headers: { 'cache-control': 'no-store' } })
  }

  const d = await loadDashboard()

  const csv = toCsv([
    ['Verified attendees (lunch headcount)', d.paid],
    [],
    ['Pass ID', 'Name', 'Email', 'AWS Builder ID', 'College', 'Tier', 'Technical session', 'Workshop'],
    // Verified only, and never a preview record: nobody caters for a test.
    ...d.attendees
      .filter((a) => a.state === 'VERIFIED' && a.source !== 'preview')
      .map((a) => [
        a.passId,
        a.name,
        a.email,
        a.builderId ? `@${a.builderId}` : '',
        a.college,
        tierLabel(a.tier),
        programSession(a.technicalSession)?.title ?? a.technicalSession,
        a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : '',
      ]),
  ])

  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="scd-attendees-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
