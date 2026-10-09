import { currentCrew } from '@/lib/auth/admin'
import { toCsv } from '@/lib/db/stats'
import { fieldLabel, listForms } from '@/lib/forms'
import { SPEAKER_FORM } from '@/lib/forms-options'

/**
 * Every speaker interest form as a spreadsheet: one row per submission,
 * one column per question in the form's own order. Admin only, because it
 * carries names, emails and phone numbers.
 */
export async function GET(): Promise<Response> {
  const session = await currentCrew()
  if (session.status !== 'ok' || session.role !== 'admin') {
    return new Response('Not an admin account.', { status: 403, headers: { 'cache-control': 'no-store' } })
  }

  const items = await listForms('speak')
  const questions = SPEAKER_FORM.flatMap((sec) => sec.questions).map((q) => q.id).filter((id) => id !== 'email')
  // Anything a submission carries that the form no longer asks, so nothing is dropped.
  const extra = [...new Set(items.flatMap((s) => Object.keys(s.fields)))].filter((k) => !questions.includes(k))
  const columns = [...questions, ...extra]

  const received = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(iso))

  const csv = toCsv([
    ['Reference', 'Received (IST)', 'Email', ...columns.map(fieldLabel)],
    ...items.map((s) => [s.ref, received(s.createdAt), s.email, ...columns.map((c) => s.fields[c] ?? '')]),
  ])

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="scd-speakers-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
