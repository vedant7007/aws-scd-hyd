import { currentCrew } from '@/lib/auth/admin'
import { speakersCsv } from '@/lib/sheets'

/** Every speaker interest form as a spreadsheet download. Admin only: it carries names, emails and phone numbers. */
export async function GET(): Promise<Response> {
  const session = await currentCrew()
  if (session.status !== 'ok' || session.role !== 'admin') {
    return new Response('Not an admin account.', { status: 403, headers: { 'cache-control': 'no-store' } })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(await speakersCsv(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="scd-speakers-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
