'use client'

import { useActionState, useMemo, useState } from 'react'
import { deleteAction, rejectAction, sendTicketAction, verifyAction, type ActionState } from '@/app/admin/(secure)/actions'
import type { RegistrationState, Tier } from '@/lib/db/types'
import { REJECTION_REASONS, rejectionCodes } from '@/lib/registration/reasons'

export type Row = {
  passId: string
  name: string
  email: string
  phone: string
  college: string
  branch: string
  rollNumber: string
  builderId: string | null
  ticketSentAt: string | null
  yearOfStudy: string
  dateOfBirth: string
  tier: Tier
  tierName: string
  technical: string
  workshop: string | null
  state: RegistrationState
  /** This person's own price, after any group discount. The money total adds these. */
  sharePaise: number
  amountLabel: string
  utr: string | null
  utrSubmittedAt: string | null
  screenshot: boolean
  rejectionReason: string | null
  createdAt: string
  /** A group pass: the leader pays and is verified for everyone; members follow. */
  group: { size: number; leader: string; isLeader: boolean; members: GroupMember[] } | null
  /** Made through the old test link: real, verifiable, never counted. */
  preview: boolean
  checkedIn: boolean
}

/** Everything about one other person in a group, shown on the payer's card. */
export type GroupMember = {
  passId: string
  name: string
  email: string
  phone: string
  college: string
  branch: string
  rollNumber: string
  yearOfStudy: string
  dateOfBirth: string
  builderId: string | null
  technical: string
  workshop: string | null
}

type Tab = 'queue' | 'verified' | 'rejected' | 'awaiting' | 'all'
type Sort = 'new' | 'old' | 'name' | 'amount'
type Filters = { tier: '' | Tier; kind: '' | 'solo' | 'group'; ticket: '' | 'sent' | 'unsent'; checkin: '' | 'in' | 'out'; builder: '' | 'missing'; college: string }

const NO_FILTERS: Filters = { tier: '', kind: '', ticket: '', checkin: '', builder: '', college: '' }
const PAGE = 40

const STATE_LABEL: Record<RegistrationState, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING_VERIFICATION: 'To verify',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ABANDONED: 'Abandoned',
}
const STATE_PILL: Record<RegistrationState, string> = {
  AWAITING_PAYMENT: 'pill pill-ghost',
  PENDING_VERIFICATION: 'pill pill-warn',
  VERIFIED: 'pill',
  REJECTED: 'pill pill-err',
  ABANDONED: 'pill pill-ghost',
}
const TIERS: [Tier, string][] = [
  ['basic', 'Regular'],
  ['premium', 'Premium'],
  ['ultra', 'Platinum'],
  ['vip', 'VIP'],
]

const isMember = (r: Row) => Boolean(r.group && !r.group.isLeader)
const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '')
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}
const norm = (s: string) => s.toLowerCase().replace(/[\s.\-@]+/g, '')

const TAB_TEST: Record<Tab, (r: Row) => boolean> = {
  // Payments to check: the payer of a group, never its members.
  queue: (r) => r.state === 'PENDING_VERIFICATION' && !isMember(r),
  verified: (r) => r.state === 'VERIFIED',
  rejected: (r) => r.state === 'REJECTED' && !isMember(r),
  awaiting: (r) => r.state === 'AWAITING_PAYMENT' && !isMember(r),
  all: () => true,
}
const TAB_LABEL: Record<Tab, string> = { queue: 'To verify', verified: 'Verified', rejected: 'Rejected', awaiting: 'Awaiting payment', all: 'All' }

const Status = ({ state }: { state: ActionState }) =>
  state ? (
    <p role="status" className={state.ok ? 'copy' : 'err-text'}>
      {state.message}
    </p>
  ) : null

/**
 * The registrations desk. A strip of numbers, tabs by status, one search box
 * across every field, filters that stack, and a slim line per person that
 * opens into the full card with its actions. Forty at a time.
 */
export function AdminConsole({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>('queue')
  const [query, setQuery] = useState('')
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [sort, setSort] = useState<Sort>('new')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const real = useMemo(() => rows.filter((r) => !r.preview), [rows])
  const kpi = useMemo(() => {
    const verified = real.filter((r) => r.state === 'VERIFIED')
    return {
      people: real.filter((r) => r.state !== 'AWAITING_PAYMENT').length,
      toVerify: real.filter(TAB_TEST.queue).length,
      verified: verified.length,
      money: verified.reduce((n, r) => n + r.sharePaise, 0),
      checkedIn: verified.filter((r) => r.checkedIn).length,
      tickets: verified.filter((r) => r.ticketSentAt).length,
      groups: real.filter((r) => r.group?.isLeader && r.state !== 'AWAITING_PAYMENT').length,
    }
  }, [real])

  const counts = useMemo(() => Object.fromEntries((Object.keys(TAB_TEST) as Tab[]).map((t) => [t, rows.filter(TAB_TEST[t]).length])) as Record<Tab, number>, [rows])

  const colleges = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.college.trim(), (m.get(r.college.trim()) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  }, [rows])

  const shown = useMemo(() => {
    const q = norm(query)
    let list = q
      ? rows.filter((r) => [r.name, r.email, r.phone, r.passId, r.utr ?? '', r.rollNumber, r.college, r.builderId ?? ''].some((v) => norm(v).includes(q)))
      : rows.filter(TAB_TEST[tab])
    if (f.tier) list = list.filter((r) => r.tier === f.tier)
    if (f.kind) list = list.filter((r) => (f.kind === 'group' ? Boolean(r.group) : !r.group))
    if (f.ticket) list = list.filter((r) => r.state === 'VERIFIED' && (f.ticket === 'sent' ? Boolean(r.ticketSentAt) : !r.ticketSentAt))
    if (f.checkin) list = list.filter((r) => (f.checkin === 'in' ? r.checkedIn : !r.checkedIn))
    if (f.builder) list = list.filter((r) => !r.builderId)
    if (f.college) list = list.filter((r) => r.college.trim() === f.college)
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      new: (a, b) => b.createdAt.localeCompare(a.createdAt),
      old: (a, b) => (tab === 'queue' ? (a.utrSubmittedAt ?? '').localeCompare(b.utrSubmittedAt ?? '') : a.createdAt.localeCompare(b.createdAt)),
      name: (a, b) => a.name.localeCompare(b.name),
      amount: (a, b) => b.sharePaise - a.sharePaise,
    }
    return [...list].sort(by[sort])
  }, [rows, tab, query, f, sort])

  const filtered = Object.values(f).some(Boolean)
  const unsentShown = shown.filter((r) => r.state === 'VERIFIED' && !r.ticketSentAt && !r.preview)

  const pickTab = (t: Tab) => {
    setTab(t)
    setQuery('')
    setLimit(PAGE)
    if (t !== 'verified') setF((x) => ({ ...x, ticket: '' }))
  }
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const exportView = () => {
    const head = ['Pass ID', 'Status', 'Name', 'Email', 'Phone', 'Builder ID', 'College', 'Branch', 'Roll', 'Year', 'Pass', 'Technical', 'Workshop', 'Amount', 'Group', 'UTR', 'Ticket sent', 'Checked in', 'Registered']
    const lines = [head, ...shown.map((r) => [r.passId, STATE_LABEL[r.state], r.name, r.email, r.phone, r.builderId ? `@${r.builderId}` : '', r.college, r.branch, r.rollNumber, r.yearOfStudy, r.tierName, r.technical, r.workshop ?? '', String(r.sharePaise / 100), r.group ? (r.group.isLeader ? `Paid for ${r.group.size}` : `In ${r.group.leader}`) : '', r.utr ?? '', r.ticketSentAt ? 'yes' : '', r.checkedIn ? 'yes' : '', when(r.createdAt)])]
    const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `scd-${tab}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="adm-kpis">
        <Kpi label="Registered" value={kpi.people} note={`${kpi.groups} groups`} />
        <Kpi label="To verify" value={kpi.toVerify} tone={kpi.toVerify ? 'warn' : undefined} note="payments" onClick={() => pickTab('queue')} />
        <Kpi label="Verified" value={kpi.verified} tone="ok" note={inr(kpi.money)} onClick={() => pickTab('verified')} />
        <Kpi label="Tickets sent" value={`${kpi.tickets}/${kpi.verified}`} note={kpi.verified - kpi.tickets ? `${kpi.verified - kpi.tickets} to send` : 'all sent'} />
        <Kpi label="Checked in" value={`${kpi.checkedIn}/${kpi.verified}`} note="at the gate" />
      </div>

      <div className="card flex flex-col">
        <div className="adm-tabs" role="tablist" aria-label="Status">
          {(Object.keys(TAB_TEST) as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t && !query} className="adm-tab" data-tone={t === 'queue' && counts.queue ? 'warn' : undefined} onClick={() => pickTab(t)}>
              {TAB_LABEL[t]}
              <span className="adm-tab-n">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="adm-tools">
          <input
            className="inp adm-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Search name, email, phone, pass ID, UTR, roll, college, Builder ID"
            aria-label="Search everyone"
            type="search"
          />
          <div className="adm-filters">
            <select className="inp adm-sel" value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value as Filters['tier'] })} aria-label="Pass">
              <option value="">All passes</option>
              {TIERS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <select className="inp adm-sel" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Filters['kind'] })} aria-label="Solo or group">
              <option value="">Solo and groups</option>
              <option value="solo">Solo only</option>
              <option value="group">Groups only</option>
            </select>
            <select className="inp adm-sel" value={f.ticket} onChange={(e) => setF({ ...f, ticket: e.target.value as Filters['ticket'] })} aria-label="Ticket">
              <option value="">Any ticket state</option>
              <option value="unsent">Ticket not sent</option>
              <option value="sent">Ticket sent</option>
            </select>
            <select className="inp adm-sel" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value as Filters['checkin'] })} aria-label="Check in">
              <option value="">Any check in</option>
              <option value="in">Checked in</option>
              <option value="out">Not checked in</option>
            </select>
            <select className="inp adm-sel" value={f.builder} onChange={(e) => setF({ ...f, builder: e.target.value as Filters['builder'] })} aria-label="Builder ID">
              <option value="">Any Builder ID</option>
              <option value="missing">Builder ID missing</option>
            </select>
            <select className="inp adm-sel" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} aria-label="College">
              <option value="">All colleges</option>
              {colleges.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select className="inp adm-sel" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="new">Newest first</option>
              <option value="old">{tab === 'queue' ? 'Waiting longest' : 'Oldest first'}</option>
              <option value="name">Name A to Z</option>
              <option value="amount">Amount, high first</option>
            </select>
          </div>
          <div className="adm-bar">
            <span className="lbl">
              {shown.length} {shown.length === 1 ? 'person' : 'people'}
              {query ? ` matching "${query}"` : ''}
            </span>
            <span className="flex flex-wrap gap-2">
              {filtered || query ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setF(NO_FILTERS)
                    setQuery('')
                  }}
                >
                  CLEAR
                </button>
              ) : null}
              <button type="button" className="btn btn-sm" onClick={exportView} disabled={!shown.length}>
                EXPORT VIEW
              </button>
              {tab === 'verified' && unsentShown.length ? <BulkTickets rows={unsentShown} /> : null}
            </span>
          </div>
        </div>

        {shown.length === 0 ? <p className="row-body">Nobody here{filtered || query ? ' with these filters' : ''}.</p> : null}
        <ul className="adm-list">
          {shown.slice(0, limit).map((r) => (
            <li key={r.passId}>
              <button type="button" className="adm-row" data-state={r.state} aria-expanded={open.has(r.passId)} onClick={() => toggle(r.passId)}>
                <span className="adm-row-main">
                  <span className="adm-row-name">{r.name}</span>
                  <span className="adm-row-sub">
                    {r.passId} · {r.college}
                  </span>
                </span>
                <span className="adm-row-tags">
                  <span className="adm-tier" data-tier={r.tier}>
                    {r.tierName}
                  </span>
                  {r.group ? <span className="adm-tag">{r.group.isLeader ? `GROUP ${r.group.size}` : 'IN GROUP'}</span> : null}
                  {r.state === 'VERIFIED' ? <span className="adm-tag" data-on={r.ticketSentAt ? '1' : undefined} title="Ticket sent">{r.ticketSentAt ? '✓ TICKET' : 'NO TICKET'}</span> : null}
                  {r.checkedIn ? <span className="adm-tag" data-on="1">✓ IN</span> : null}
                  {!r.builderId ? <span className="adm-tag" data-warn="1">NO BUILDER</span> : null}
                  {r.preview ? <span className="adm-tag" data-warn="1">TEST</span> : null}
                </span>
                <span className="adm-row-end">
                  <span className="adm-row-amt">{r.group?.isLeader ? r.amountLabel : inr(r.sharePaise)}</span>
                  <span className="adm-row-time" suppressHydrationWarning>{ago(r.createdAt)}</span>
                </span>
                <span className="adm-row-chev" aria-hidden="true">
                  {open.has(r.passId) ? '−' : '+'}
                </span>
              </button>
              {open.has(r.passId) ? <RowCard row={r} /> : null}
            </li>
          ))}
        </ul>
        {shown.length > limit ? (
          <button type="button" className="btn adm-more" onClick={() => setLimit((l) => l + PAGE)}>
            SHOW {Math.min(PAGE, shown.length - limit)} MORE · {shown.length - limit} LEFT
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Kpi({ label, value, note, tone, onClick }: { label: string; value: number | string; note?: string; tone?: 'ok' | 'warn'; onClick?: () => void }) {
  const body = (
    <>
      <span className="lbl">{label}</span>
      <span className="adm-kpi-v" data-tone={tone}>
        {value}
      </span>
      {note ? <span className="hint">{note}</span> : null}
    </>
  )
  return onClick ? (
    <button type="button" className="adm-kpi" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="adm-kpi">{body}</div>
  )
}

/** Send every shown, verified, ticketless person their ticket, one after another, after a second tap to confirm. */
function BulkTickets({ rows }: { rows: Row[] }) {
  const [armed, setArmed] = useState(false)
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null)
  const run = async () => {
    setArmed(false)
    let done = 0
    let failed = 0
    setProgress({ done, failed })
    for (const r of rows) {
      const form = new FormData()
      form.set('passId', r.passId)
      const out = await sendTicketAction(null, form).catch(() => ({ ok: false, message: '' }))
      if (out?.ok) done++
      else failed++
      setProgress({ done, failed })
    }
  }
  if (progress) {
    const finished = progress.done + progress.failed === rows.length
    return (
      <span className="lbl" role="status">
        {finished ? `Sent ${progress.done}${progress.failed ? `, ${progress.failed} failed` : ''}. Refresh to update.` : `Sending ${progress.done + progress.failed + 1} of ${rows.length}…`}
      </span>
    )
  }
  return armed ? (
    <button type="button" className="btn btn-sm btn-primary" onClick={run}>
      CONFIRM: SEND {rows.length} TICKETS
    </button>
  ) : (
    <button type="button" className="btn btn-sm btn-mint" onClick={() => setArmed(true)}>
      SEND TICKETS TO {rows.length} NOT SENT
    </button>
  )
}

function RowCard({ row }: { row: Row }) {
  const [verifyState, verify, verifying] = useActionState(verifyAction, null)
  const [rejectState, reject, rejecting] = useActionState(rejectAction, null)
  const [deleteState, del, deleting] = useActionState(deleteAction, null)
  const [ticketState, sendTicket, sendingTicket] = useActionState(sendTicketAction, null)
  const result = verifyState ?? rejectState ?? deleteState ?? ticketState
  const busy = verifying || rejecting || deleting || sendingTicket

  return (
    <article className="adm-card" aria-label={`${row.name}, ${row.passId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="num text-[12px] text-muted">
            {row.email} · {row.phone}
          </span>
          <span className="hint">
            {row.college} · {row.branch} · {row.rollNumber} · year {row.yearOfStudy} · born {row.dateOfBirth}
          </span>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {row.group ? <span className="pill pill-orange">{row.group.isLeader ? `Group of ${row.group.size} · pays` : `In group ${row.group.leader}`}</span> : null}
          <span className={STATE_PILL[row.state]}>{STATE_LABEL[row.state]}</span>
        </span>
      </div>

      <dl className="grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <div className="flex flex-col gap-0.5">
          <dt className="lbl-sm">Pass</dt>
          <dd className="copy text-ink">
            {row.tierName}
            {row.checkedIn ? <span className="lbl-sm"> · checked in</span> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="lbl-sm">{row.group?.isLeader ? `Amount expected, all ${row.group.size}` : row.group ? 'Their share' : 'Amount expected'}</dt>
          <dd className="num text-[15px] font-semibold text-ink">{row.amountLabel}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:col-span-2">
          <dt className="lbl-sm">Sessions</dt>
          <dd className="copy text-ink">
            {row.technical}
            {row.workshop ? <span className="block">{row.workshop}</span> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="lbl-sm">UTR</dt>
          <dd className="num text-[15px] text-ink">
            {row.utr ?? '-'}
            {row.utrSubmittedAt ? <span className="hint block">at {when(row.utrSubmittedAt)}</span> : null}
          </dd>
        </div>
        {row.screenshot ? (
          <div className="flex flex-col gap-0.5">
            <dt className="lbl-sm">Screenshot</dt>
            <dd>
              <a className="btn btn-mono" href={`/admin/screenshot/${row.passId}`} target="_blank" rel="noopener">
                Open, 60 second link
              </a>
            </dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <dt className="lbl-sm">AWS Builder ID</dt>
          <dd className="num text-[14px] text-ink">
            {row.builderId ? (
              <a href={`https://builder.aws.com/community/@${row.builderId}`} target="_blank" rel="noopener">
                @{row.builderId}
              </a>
            ) : (
              'Not given yet'
            )}
          </dd>
        </div>
        {row.rejectionReason ? (
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <dt className="lbl-sm">Rejected because</dt>
            <dd className="copy">{row.rejectionReason}</dd>
          </div>
        ) : null}
      </dl>

      {row.group?.isLeader ? (
        <section className="flex flex-col gap-2.5" aria-label="Everyone else in this group">
          <span className="lbl-sm">Everyone else in this group · {row.group.members.length}</span>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            {row.group.members.map((m, i) => (
              <div key={m.passId} className="card-dash flex flex-col gap-1.5 p-3">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="h3 text-[19px]">
                    {i + 2}. {m.name}
                  </span>
                  <span className="num text-[11.5px] text-muted">{m.passId}</span>
                </span>
                <span className="num text-[12px] text-muted">
                  {m.email} · {m.phone}
                </span>
                <span className="hint">
                  {m.college} · {m.branch} · {m.rollNumber} · year {m.yearOfStudy} · born {m.dateOfBirth}
                </span>
                <span className="copy text-[13px] text-ink">
                  {m.technical}
                  {m.workshop ? <span className="block">{m.workshop}</span> : null}
                </span>
                <span className="num text-[13px]">
                  <span className="lbl-sm">Builder ID </span>
                  {m.builderId ? (
                    <a href={`https://builder.aws.com/community/@${m.builderId}`} target="_blank" rel="noopener">
                      @{m.builderId}
                    </a>
                  ) : (
                    'Not given yet'
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {row.group && !row.group.isLeader ? <p className="hint">Paid for by {row.group.leader}. Verify or reject that registration and this one moves with it.</p> : null}

      {row.state === 'PENDING_VERIFICATION' && !isMember(row) ? (
        <div className="flex flex-col gap-3">
          <form action={verify}>
            <input type="hidden" name="passId" value={row.passId} />
            <button type="submit" className="btn btn-mint btn-lg" disabled={busy}>
              ✓ VERIFY{row.group?.isLeader ? ` ALL ${row.group.size}` : ''}
            </button>
          </form>
          <form action={reject} className="card-dash flex flex-wrap items-end gap-3 p-3">
            <input type="hidden" name="passId" value={row.passId} />
            <div className="fld min-w-0 flex-[1_1_220px]">
              <label htmlFor={`reason-${row.passId}`}>Reason</label>
              <select id={`reason-${row.passId}`} name="reasonCode" className="inp" defaultValue="not-found">
                {rejectionCodes.map((c) => (
                  <option key={c} value={c}>
                    {REJECTION_REASONS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="fld min-w-0 flex-[1_1_220px]">
              <label htmlFor={`note-${row.passId}`}>Note, required for Other</label>
              <input id={`note-${row.passId}`} name="reason" className="inp" maxLength={300} />
            </div>
            <button type="submit" className="btn btn-warn" disabled={busy}>
              REJECT
            </button>
          </form>
        </div>
      ) : null}

      {row.state === 'VERIFIED' ? (
        <form action={sendTicket} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="passId" value={row.passId} />
          <button type="submit" className={row.ticketSentAt ? 'btn' : 'btn btn-primary'} disabled={busy}>
            {sendingTicket ? 'SENDING' : row.ticketSentAt ? 'RESEND TICKET' : 'SEND TICKET'}
          </button>
          <span className="hint">{row.ticketSentAt ? `Ticket sent ${when(row.ticketSentAt)}` : 'Ticket not sent yet'}</span>
          <a href={`/pass/${row.passId}`} target="_blank" rel="noopener" className="hint">
            View their ticket
          </a>
        </form>
      ) : null}

      <details>
        <summary className="lbl-sm cursor-pointer">{row.group ? `Delete this whole group of ${row.group.size}` : 'Delete this registration'}</summary>
        <form action={del} className="card-dash mt-2 flex flex-wrap items-end gap-3 p-3">
          <input type="hidden" name="passId" value={row.passId} />
          <div className="fld min-w-0 flex-[1_1_220px]">
            <label htmlFor={`del-${row.passId}`}>Type DELETE. Record, UTR, screenshot and seats all go, for good.</label>
            <input id={`del-${row.passId}`} name="confirm" className="inp" autoComplete="off" required />
          </div>
          <button type="submit" className="btn btn-warn" disabled={busy}>
            DELETE
          </button>
        </form>
      </details>

      <Status state={result} />
    </article>
  )
}
