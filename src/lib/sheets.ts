import { timingSafeEqual } from 'node:crypto'
import { tierLabel } from '../content/passes'
import { collegeOf } from '../content/colleges'
import { programSession } from '../content/program'
import { listAttendees } from './db/queries'
import { board } from './referral/store'
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

const STATUS: Record<string, string> = { PENDING_VERIFICATION: 'TO VERIFY', VERIFIED: 'VERIFIED', REJECTED: 'REJECTED' }
const STATUS_ORDER = ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED']


const sessionTitle = (id: string | undefined) => (id ? (programSession(id)?.title ?? id) : '')
const tick = (iso: string | undefined) => (iso ? `✓ ${ist(iso).replace('​', '')}` : '')

/** Paid or past it: everyone on the sheets. Never the half finished. */
const onSheet = async () => (await listAttendees()).filter((a) => a.source !== 'preview' && a.state in STATUS)

/**
 * Every registration that got as far as paying, one person per row. Payments
 * to verify first, then verified, then rejected; newest first inside each,
 * and a group stays together with the person who paid on top.
 */
export async function registrationsCsv(): Promise<string> {
  const all = await onSheet()
  const lead = new Map(all.map((a) => [a.passId, a]))
  const anchor = (a: (typeof all)[number]) => (a.groupId ? (lead.get(a.groupId) ?? a) : a)
  const rows = [...all].sort(
    (x, y) =>
      STATUS_ORDER.indexOf(x.state) - STATUS_ORDER.indexOf(y.state) ||
      anchor(y).createdAt.localeCompare(anchor(x).createdAt) ||
      anchor(x).passId.localeCompare(anchor(y).passId) ||
      Number(y.groupId === y.passId) - Number(x.groupId === x.passId) ||
      x.name.localeCompare(y.name),
  )
  return toCsv([
    ['#', 'Status', 'Pass ID', 'Name', 'College', 'Pass', 'Technical session', 'Workshop', 'Their price (₹)', 'Group', 'Group pays (₹)', 'UTR', 'AWS Builder ID', 'Email', 'Phone', 'Roll number', 'Branch', 'Year', 'Date of birth', 'Registered (IST)', 'Verified (IST)', 'Ticket sent', 'Checked in', 'Swag', 'Rejected because', 'Referred by', 'Their code'],
    ...rows.map((a, i) => {
      const payer = a.groupId === a.passId
      return [
        i + 1,
        STATUS[a.state],
        a.passId,
        a.name,
        a.college,
        tierLabel(a.tier),
        sessionTitle(a.technicalSession),
        sessionTitle(a.workshop),
        a.amountPaise / 100,
        a.groupId ? (payer ? `PAYS for ${a.groupSize ?? ''}` : `with ${a.groupId}`) : '',
        payer ? (a.groupTotalPaise ?? a.amountPaise) / 100 : a.groupId ? '' : a.amountPaise / 100,
        payer || !a.groupId ? asText(a.utr) : 'on the payer',
        a.builderId ? `@${a.builderId}` : 'MISSING',
        a.email,
        asText(a.phone),
        asText(a.rollNumber),
        a.branch,
        a.yearOfStudy,
        asText(a.dateOfBirth),
        ist(a.createdAt),
        a.state === 'VERIFIED' ? ist(a.verifiedAt) : '',
        tick(a.ticketSentAt),
        tick(a.checkedInAt),
        tick(a.swagIssuedAt),
        a.rejectionReason ?? '',
        a.referredBy ?? '',
        a.refCode ?? '',
      ]
    }),
  ])
}

/** The numbers at a glance: status, money, passes, sessions, colleges. Two columns, sections one under another. */
export async function summaryCsv(): Promise<string> {
  const all = await onSheet()
  const live = all.filter((a) => a.state !== 'REJECTED')
  const verified = all.filter((a) => a.state === 'VERIFIED')
  // Money is counted on the payer: a group's total, or a solo person's price.
  const money = (list: typeof all) => list.filter((a) => !a.groupId || a.groupId === a.passId).reduce((n, a) => n + (a.groupTotalPaise ?? a.amountPaise), 0) / 100
  const count = <K extends string>(list: typeof all, key: (a: (typeof all)[number]) => K | undefined) => {
    const m = new Map<K, number>()
    for (const a of list) {
      const k = key(a)
      if (k) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m].sort((x, y) => y[1] - x[1])
  }
  const section = (title: string, rows: [string, string | number][]) => [['', ''], [title, ''], ...rows]
  return toCsv([
    ['AWS SCD Hyderabad 2026', `Updated ${ist(new Date().toISOString()).replace('​', '')} IST`],
    ...section('STATUS', [
      ['Registered (to verify + verified)', live.length],
      ['To verify', all.filter((a) => a.state === 'PENDING_VERIFICATION').length],
      ['Verified', verified.length],
      ['Rejected', all.length - live.length],
      ['Groups', live.filter((a) => a.groupId === a.passId).length],
      ['Builder ID missing', live.filter((a) => !a.builderId).length],
    ]),
    ...section('MONEY (₹)', [
      ['Verified and received', money(verified)],
      ['Waiting to verify', money(all.filter((a) => a.state === 'PENDING_VERIFICATION'))],
    ]),
    ...section('ON THE DAY (verified)', [
      ['Tickets sent', verified.filter((a) => a.ticketSentAt).length],
      ['Checked in', verified.filter((a) => a.checkedInAt).length],
      ['Swag given', verified.filter((a) => a.swagIssuedAt).length],
    ]),
    ...section('BY PASS', count(live, (a) => tierLabel(a.tier))),
    ...section('TECHNICAL SESSIONS', count(live, (a) => sessionTitle(a.technicalSession))),
    ...section('WORKSHOPS', count(live, (a) => (a.workshop ? sessionTitle(a.workshop) : undefined))),
    ...section('BY YEAR', count(live, (a) => (a.yearOfStudy ? `Year ${a.yearOfStudy}` : undefined))),
    ...section('BY COLLEGE', count(live, (a) => collegeOf(a.college))),
  ])
}

/** The referral leaderboard as a sheet: every code with a referral, with the owner's pass and email for the prizes. */
export async function referralsCsv(): Promise<string> {
  const all = await listAttendees()
  const owner = new Map(all.filter((a) => a.refCode).map((a) => [a.refCode!, a]))
  return toCsv([
    ['Rank', 'Code', 'Name', 'College', 'Referrals', 'Pass ID', 'Email', 'Phone'],
    ...board(all).map((r) => {
      const o = owner.get(r.code)!
      return [r.rank, r.code, o.name, o.college, r.count, o.passId, o.email, asText(o.phone)]
    }),
  ])
}

export const SHEETS = { speakers: speakersCsv, registrations: registrationsCsv, summary: summaryCsv, referrals: referralsCsv } as const
export type SheetKind = keyof typeof SHEETS

/** The feed key from the server environment, compared in constant time. False while it is unset. */
export function sheetKeyOk(given: string | null): boolean {
  const want = process.env.SCD_SHEETS_KEY?.trim()
  if (!want || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}
