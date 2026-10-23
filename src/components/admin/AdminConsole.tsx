'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import { calledAction, messagedAction, deleteAction, rejectAction, sendTicketAction, verifyAction, type ActionState } from '@/app/admin/(secure)/actions'
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
  /** Their own referral code, and the code they registered with. */
  refCode: string | null
  referredBy: string | null
  /** The team phoned them: when and by whom. */
  calledAt: string | null
  calledBy: string | null
  /** The personal WhatsApp message went: when and by whom. */
  messagedAt: string | null
  messagedBy: string | null
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
  calledAt: string | null
  calledBy: string | null
  messagedAt: string | null
  messagedBy: string | null
}

/** What the Called and WhatsApp buttons need about one person: a row, or someone inside a group's card. */
type Contact = Pick<Row, 'passId' | 'name' | 'phone' | 'builderId' | 'state'>
type Tick = { at: string | null; by: string | null }
/** The team's ticks, shared by every place a person's buttons appear, so a row and a group card never disagree. */
type Ticks = { called: (id: string, fallback: Tick) => Tick; messaged: (id: string, fallback: Tick) => Tick; setCalled: (id: string, t: Tick) => void; setMessaged: (id: string, t: Tick) => void }

type Tab = 'queue' | 'verified' | 'rejected' | 'awaiting' | 'all'
type Sort = 'new' | 'old' | 'name' | 'amount'
type Filters = { tier: '' | Tier; kind: '' | 'solo' | 'group'; ticket: '' | 'sent' | 'unsent'; checkin: '' | 'in' | 'out'; builder: '' | 'missing'; called: '' | 'yes' | 'no'; messaged: '' | 'yes' | 'no'; college: string }

const NO_FILTERS: Filters = { tier: '', kind: '', ticket: '', checkin: '', builder: '', called: '', messaged: '', college: '' }
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
export function AdminConsole({ rows, sheetUrl }: { rows: Row[]; sheetUrl: string | null }) {
  const [tab, setTab] = useState<Tab>('queue')
  const [query, setQuery] = useState('')
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [sort, setSort] = useState<Sort>('new')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<Set<string>>(new Set())
  /** Called ticks made on this page, ahead of the next server render. */
  const [calls, setCalls] = useState<Record<string, { at: string | null; by: string | null }>>({})
  const calledOf = (r: Row) => (r.passId in calls ? calls[r.passId]! : { at: r.calledAt, by: r.calledBy })
  const ticks: Ticks = {
    called: (id, fb) => calls[id] ?? fb,
    messaged: (id, fb) => msgs[id] ?? fb,
    setCalled: (id, t) => setCalls((m) => ({ ...m, [id]: t })),
    setMessaged: (id, t) => setMsgs((m) => ({ ...m, [id]: t })),
  }
  const [msgs, setMsgs] = useState<Record<string, { at: string | null; by: string | null }>>({})
  const messagedOf = (r: Row) => (r.passId in msgs ? msgs[r.passId]! : { at: r.messagedAt, by: r.messagedBy })

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

  // Recomputed each render: a few hundred rows, and the React compiler memoises it anyway.
  const shown = (() => {
    const q = norm(query)
    let list = q
      ? rows.filter((r) => [r.name, r.email, r.phone, r.passId, r.utr ?? '', r.rollNumber, r.college, r.builderId ?? ''].some((v) => norm(v).includes(q)))
      : rows.filter(TAB_TEST[tab])
    if (f.tier) list = list.filter((r) => r.tier === f.tier)
    if (f.kind) list = list.filter((r) => (f.kind === 'group' ? Boolean(r.group) : !r.group))
    if (f.ticket) list = list.filter((r) => r.state === 'VERIFIED' && (f.ticket === 'sent' ? Boolean(r.ticketSentAt) : !r.ticketSentAt))
    if (f.checkin) list = list.filter((r) => (f.checkin === 'in' ? r.checkedIn : !r.checkedIn))
    if (f.builder) list = list.filter((r) => !r.builderId)
    if (f.called) list = list.filter((r) => Boolean((r.passId in calls ? calls[r.passId]!.at : r.calledAt)) === (f.called === 'yes'))
    if (f.messaged) list = list.filter((r) => Boolean((r.passId in msgs ? msgs[r.passId]!.at : r.messagedAt)) === (f.messaged === 'yes'))
    if (f.college) list = list.filter((r) => r.college.trim() === f.college)
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      new: (a, b) => b.createdAt.localeCompare(a.createdAt),
      old: (a, b) => (tab === 'queue' ? (a.utrSubmittedAt ?? '').localeCompare(b.utrSubmittedAt ?? '') : a.createdAt.localeCompare(b.createdAt)),
      name: (a, b) => a.name.localeCompare(b.name),
      amount: (a, b) => b.sharePaise - a.sharePaise,
    }
    return [...list].sort(by[sort])
  })()

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
            <select className="inp adm-sel" value={f.messaged} onChange={(e) => setF({ ...f, messaged: e.target.value as Filters['messaged'] })} aria-label="WhatsApp">
              <option value="">WhatsApp sent or not</option>
              <option value="no">Not messaged yet</option>
              <option value="yes">Messaged</option>
            </select>
            <select className="inp adm-sel" value={f.called} onChange={(e) => setF({ ...f, called: e.target.value as Filters['called'] })} aria-label="Called">
              <option value="">Called or not</option>
              <option value="no">Not called yet</option>
              <option value="yes">Called</option>
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
              {sheetUrl ? (
                <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-mint">
                  OPEN GOOGLE SHEET
                </a>
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
            <li key={r.passId} className="adm-li">
              <div className="adm-li-line">
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
              <div className="adm-call">
                <WhatsAppCell row={r} sent={messagedOf(r)} onChange={(c) => setMsgs((m) => ({ ...m, [r.passId]: c }))} />
                <CallCell row={r} called={calledOf(r)} onChange={(c) => setCalls((m) => ({ ...m, [r.passId]: c }))} />
              </div>
              </div>
              {open.has(r.passId) ? <RowCard row={r} ticks={ticks} /> : null}
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

/** Beside each row: the "called" tick the whole team sees. Calls are made by hand; this only keeps the record. */
function CallCell({ row, called, onChange }: { row: Contact; called: { at: string | null; by: string | null }; onChange: (c: { at: string | null; by: string | null }) => void }) {
  const [pending, start] = useTransition()
  const [failed, setFailed] = useState(false)
  const flip = () =>
    start(async () => {
      const before = called
      const next = !called.at
      onChange(next ? { at: new Date().toISOString(), by: 'you' } : { at: null, by: null })
      setFailed(false)
      try {
        const out = await calledAction(row.passId, next)
        if (!out.ok) throw new Error()
        onChange({ at: out.at, by: out.by })
      } catch {
        onChange(before)
        setFailed(true)
      }
    })
  return (
      <button
        type="button"
        className="adm-call-btn"
        data-on={called.at ? '1' : undefined}
        data-failed={failed ? '1' : undefined}
        aria-pressed={Boolean(called.at)}
        aria-label={`Called ${row.name}`}
        disabled={pending}
        onClick={flip}
        title={called.at ? `Called by ${called.by ?? 'someone'}, ${when(called.at)}. Click to undo.` : 'Tick once you have called them'}
      >
        {failed ? 'RETRY' : called.at ? '✓ CALLED' : 'CALLED'}
      </button>
  )
}

/**
 * The personal WhatsApp message, typed for this person: their name, pass ID,
 * when the ticket comes, their referral page, and the Builder ID if missing.
 * Sent by hand from the admin's own WhatsApp; this only opens the chat.
 */
function whatsAppText(r: Contact, origin: string): string {
  const first = r.name.split(' ')[0]
  const status = 'Your registration is confirmed ✅ You will receive your ticket by email on *28 October*, two days before the event.'
  return [
    `Hello ${first}, greetings from the AWS Student Community Day Hyderabad 2026 team 👋`,
    'Thank you for registering. We are glad to have you with us.',
    status,
    `Your pass ID is *${r.passId}*. Please keep it handy.`,
    `🏆 *Referral leaderboard:* we are expanding our seat limit, so you can now refer your friends to join you. Share your referral code, and the top 3 referrers will win exciting tech prizes. Get your code here (open until 24 October, 11:59 PM): ${origin}/refer?pass=${r.passId}`,
    ...(r.builderId ? [] : [`🆔 *Action needed:* please add your AWS Builder ID to your registration, as it is required at entry: ${origin}/builder-id?pass=${r.passId}`]),
    `📸 *Share that you are attending:* create your "I'm attending" post and share it on LinkedIn, Instagram and your other social media, tagging @awssbg_vjit: ${origin}/attending`,
    '📲 Follow us on Instagram for event updates: https://www.instagram.com/awssbg_vjit',
    'We look forward to seeing you on *30 October at VJIT, Hyderabad*.',
  ].join('\n')
}

/** Opens WhatsApp on this person's chat with the message typed, and marks it sent for the team. Click the green one to undo. */
function WhatsAppCell({ row, sent, onChange }: { row: Contact; sent: { at: string | null; by: string | null }; onChange: (c: { at: string | null; by: string | null }) => void }) {
  const [pending, start] = useTransition()
  const [failed, setFailed] = useState(false)
  const digits = row.phone.replace(/\D/g, '')
  const mark = (on: boolean) =>
    start(async () => {
      const before = sent
      onChange(on ? { at: new Date().toISOString(), by: 'you' } : { at: null, by: null })
      setFailed(false)
      try {
        const out = await messagedAction(row.passId, on)
        if (!out.ok) throw new Error()
        onChange({ at: out.at, by: out.by })
      } catch {
        onChange(before)
        setFailed(true)
      }
    })
  if (sent.at) {
    return (
      <button type="button" className="adm-call-btn" data-on="1" disabled={pending} onClick={() => mark(false)} title={`Messaged by ${sent.by ?? 'someone'}, ${when(sent.at)}. Click to undo.`} aria-label={`WhatsApp sent to ${row.name}, undo`}>
        ✓ WA SENT
      </button>
    )
  }
  return (
    <a
      className="adm-call-btn adm-wa"
      data-failed={failed ? '1' : undefined}
      href={`https://wa.me/${digits}?text=${encodeURIComponent(whatsAppText(row, typeof window === 'undefined' ? 'https://awsscdhyd.in' : window.location.origin))}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => mark(true)}
      title={`Open WhatsApp to ${row.phone} with the message typed`}
      aria-label={`WhatsApp ${row.name}`}
    >
      {failed ? 'RETRY' : 'WHATSAPP'}
    </a>
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

function RowCard({ row, ticks }: { row: Row; ticks: Ticks }) {
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
        {row.refCode || row.referredBy ? (
          <div className="flex flex-col gap-0.5">
            <dt className="lbl-sm">Referral</dt>
            <dd className="num text-[14px] text-ink">
              {row.refCode ? <span className="block">Their code: {row.refCode}</span> : null}
              {row.referredBy ? <span className="block">Referred by: {row.referredBy}</span> : null}
            </dd>
          </div>
        ) : null}
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
                {/* Each person is called and messaged on their own, not through the payer. */}
                <span className="adm-call adm-call-in">
                  <WhatsAppCell
                    row={{ ...m, state: row.state }}
                    sent={ticks.messaged(m.passId, { at: m.messagedAt, by: m.messagedBy })}
                    onChange={(t) => ticks.setMessaged(m.passId, t)}
                  />
                  <CallCell row={{ ...m, state: row.state }} called={ticks.called(m.passId, { at: m.calledAt, by: m.calledBy })} onChange={(t) => ticks.setCalled(m.passId, t)} />
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
