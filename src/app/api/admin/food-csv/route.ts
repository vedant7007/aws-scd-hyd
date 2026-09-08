import { currentAdmin } from '@/lib/auth/admin'
import { loadDashboard, toCsv } from '@/lib/db/stats'

/**
 * The caterer's number. Gated by the same allowlist as the dashboard, because
 * this is the whole attendee roster with names and emails in it.
 */
export async function GET(): Promise<Response> {
  const session = await currentAdmin()
  if (session.status !== 'ok') {
    return new Response('Not an organiser account.', { status: 403 })
  }

  const d = await loadDashboard()

  const csv = toCsv([
    ['Food preference', 'Count'],
    ...d.byFood.map((f) => [f.food, f.count]),
    [],
    ['Total paid attendees', d.paid],
    [],
    ['Ticket', 'Name', 'Email', 'College', 'Tier', 'Food', 'Payment status'],
    ...d.attendees
      .filter((a) => a.paymentStatus === 'paid')
      .map((a) => [a.ticketRef, a.name, a.email, a.college, a.tier, a.foodPreference, a.paymentStatus]),
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
