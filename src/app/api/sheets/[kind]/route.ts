import { SHEETS, sheetKeyOk, type SheetKind } from '@/lib/sheets'

/**
 * Live feeds for Google Sheets: =IMPORTDATA("https://awsscdhyd.in/api/sheets/registrations?key=...").
 * The key lives only in the server environment (SCD_SHEETS_KEY), never in
 * the repo. Without the right key, or while it is unset, every feed is the
 * same 404, so the URL tells a stranger nothing.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: RouteContext<'/api/sheets/[kind]'>): Promise<Response> {
  const { kind } = await params
  const key = new URL(req.url).searchParams.get('key')
  if (!(kind in SHEETS) || !sheetKeyOk(key)) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  const csv = await SHEETS[kind as SheetKind]()
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } })
}
