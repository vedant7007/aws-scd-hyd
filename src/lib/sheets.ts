import { timingSafeEqual } from 'node:crypto'
import { tierLabel } from '../content/passes'
import { programSession } from '../content/program'
import { listAttendees } from './db/queries'
import { toCsv } from './db/stats'
import { fieldLabel, listForms } from './forms'
import { SPEAKER_FORM } from './forms-options'

/**
 * The spreadsheets behind the admin exports and the live Google Sheet feeds.
 * A sheet pulls a feed with =IMPORTDATA(url) and refreshes it on Google's
 * schedule, about hourly; the feed is always the table as it is now, so a
 * new or changed row simply appears on the next refresh.
 */

/**
 * Text Google Sheets keeps as written. IMPORTDATA turns anything that looks
 * like a date or a long number into a bare serial (46301.96, 6.6E+11); a
 * zero-width space in front stops that and is invisible in the cell.
 */
const asText = (v: string | undefined) => (v ? `​${v}` : '')

const ist = (iso: string | undefined) =>
  iso ? asText(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(iso))) : ''

/** Every speaker interest form, one column per question in the form's order. */
export async function speakersCsv(): Promise<string> {
  const items = await listForms('speak')
  const questions = SPEAKER_FORM.flatMap((sec) => sec.questions).map((q) => q.id).filter((id) => id !== 'email')
  // Anything a submission carries that the form no longer asks, so nothing is dropped.
  const extra = [...new Set(items.flatMap((s) => Object.keys(s.fields)))].filter((k) => !questions.includes(k))
  const columns = [...questions, ...extra]
  return toCsv([
    ['Reference', 'Received (IST)', 'Email', ...columns.map(fieldLabel)],
    ...items.map((s) => [s.ref, ist(s.createdAt), s.email, ...columns.map((c) => s.fields[c] ?? '')]),
  ])
}

/** Every registration that got as far as paying, newest first, one person per row, groups included. */
export async function registrationsCsv(): Promise<string> {
  const rows = (await listAttendees())
    .filter((a) => a.state !== 'AWAITING_PAYMENT' && a.state !== 'ABANDONED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return toCsv([
    ['Pass ID', 'Status', 'Name', 'Email', 'Phone', 'AWS Builder ID', 'College', 'Branch', 'Roll number', 'Year', 'Date of birth', 'Pass', 'Technical session', 'Workshop', 'Amount (₹)', 'Group', 'UTR', 'Registered (IST)', 'Verified (IST)'],
    ...rows.map((a) => [
      a.passId,
      a.state.replace('_', ' ').toLowerCase(),
      a.name,
      a.email,
      asText(a.phone),
      a.builderId ? `@${a.builderId}` : '',
      a.college,
      a.branch,
      asText(a.rollNumber),
      a.yearOfStudy,
      asText(a.dateOfBirth),
      tierLabel(a.tier),
      programSession(a.technicalSession)?.title ?? a.technicalSession,
      a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : '',
      a.amountPaise / 100,
      a.groupId ? (a.groupId === a.passId ? `Paid for group of ${a.groupSize ?? ''}` : `In group ${a.groupId}`) : '',
      asText(a.utr),
      ist(a.createdAt),
      a.state === 'VERIFIED' ? ist(a.verifiedAt) : '',
    ]),
  ])
}

export const SHEETS = { speakers: speakersCsv, registrations: registrationsCsv } as const
export type SheetKind = keyof typeof SHEETS

/** The feed key from the server environment, compared in constant time. False while it is unset. */
export function sheetKeyOk(given: string | null): boolean {
  const want = process.env.SCD_SHEETS_KEY?.trim()
  if (!want || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}
