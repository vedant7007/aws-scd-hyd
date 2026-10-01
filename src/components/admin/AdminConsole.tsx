'use client'

import { useActionState, useMemo, useState } from 'react'
import { reinstateAction, rejectAction, verifyAction, type ActionState } from '@/app/admin/(secure)/actions'
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
  yearOfStudy: string
  dateOfBirth: string
  tier: Tier
  tierName: string
  technical: string
  workshop: string | null
  state: RegistrationState
  amountLabel: string
  utr: string | null
  utrSubmittedAt: string | null
  screenshot: boolean
  rejectionReason: string | null
  createdAt: string
  /** Made through the old test link: real, verifiable, never counted. */
  preview: boolean
  checkedIn: boolean
}

type View = 'queue' | 'verified' | 'all'

/**
 * Abandoned holds (the student left before paying, seats already given
 * back) are not counted or listed: they only pile up. A search still finds
 * one, so a late payer can be reinstated.
 */
const STATES: RegistrationState[] = ['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED']

/** How a state reads: the word is the signal, the colour only repeats it. */
const STATE_LABEL: Record<RegistrationState, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING_VERIFICATION: 'Pending verification',
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

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '')

const Status = ({ state }: { state: ActionState }) =>
  state ? (
    <p role="status" className={state.ok ? 'copy' : 'err-text'}>
      {state.message}
    </p>
  ) : null

/**
 * Default view is the verification queue, oldest first. Counts for every
 * state. Search by pass id, UTR, email or roll number. Every row action posts
 * to a server action that resolves the admin and asserts the state.
 */
export function AdminConsole({ rows }: { rows: Row[] }) {
  const [view, setView] = useState<View>('queue')
  const [query, setQuery] = useState('')

  const live = useMemo(() => rows.filter((r) => r.state !== 'ABANDONED'), [rows])
  const counts = useMemo(() => Object.fromEntries(STATES.map((s) => [s, rows.filter((r) => r.state === s).length])), [rows])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[\s-]+/g, '')
    let list = live
    if (q) {
      list = rows.filter(
        (r) =>
          r.passId.toLowerCase().replace(/-/g, '').includes(q) ||
          (r.utr ?? '').toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q),
      )
    } else if (view === 'queue') {
      list = rows.filter((r) => r.state === 'PENDING_VERIFICATION').sort((a, b) => (a.utrSubmittedAt ?? '').localeCompare(b.utrSubmittedAt ?? ''))
    } else if (view === 'verified') {
      list = rows.filter((r) => r.state === 'VERIFIED').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return list
  }, [rows, live, view, query])

  const viewLabel: Record<View, string> = {
    queue: `Queue (${counts.PENDING_VERIFICATION})`,
    verified: `Verified (${counts.VERIFIED})`,
    all: `All (${live.length})`,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {STATES.map((s) => (
          <div key={s} className="stat-card">
            <span className="lbl">{STATE_LABEL[s]}</span>
            <span className="stat-val" data-tone={s === 'PENDING_VERIFICATION' && counts[s] ? 'warn' : s === 'REJECTED' && counts[s] ? 'err' : undefined}>
              {counts[s]}
            </span>
          </div>
        ))}
      </div>

      <div className="card flex flex-col">
        <div className="card-head">
          <span className="card-title">ATTENDEES</span>
          <span className="lbl">
            {shown.length} of {live.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 border-b border-line-soft p-4">
          <input
            className="inp min-w-0 flex-[1_1_220px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pass ID, UTR, email or roll number"
            aria-label="Search by pass ID, UTR, email or roll number"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="View">
            {(['queue', 'verified', 'all'] as View[]).map((v) => (
              <button key={v} type="button" className="tog tog-mono" onClick={() => setView(v)} aria-pressed={view === v && !query}>
                {viewLabel[v]}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? <p className="row-body">Nobody here.</p> : null}
        {shown.map((r) => (
          <RowCard key={r.passId} row={r} />
        ))}
      </div>
    </div>
  )
}

function RowCard({ row }: { row: Row }) {
  const [verifyState, verify, verifying] = useActionState(verifyAction, null)
  const [rejectState, reject, rejecting] = useActionState(rejectAction, null)
  const [reinstateState, reinstate, reinstating] = useActionState(reinstateAction, null)
  const result = verifyState ?? rejectState ?? reinstateState
  const busy = verifying || rejecting || reinstating

  return (
    <article className="flex flex-col gap-3 border-t border-line-soft p-4" aria-label={`${row.name}, ${row.passId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="h3">{row.name}</span>
          <span className="num text-[12px] text-muted">
            {row.passId} · {row.email} · {row.phone}
          </span>
          <span className="hint">
            {row.college} · {row.branch} · {row.rollNumber} · year {row.yearOfStudy} · born {row.dateOfBirth}
          </span>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {row.preview ? <span className="pill pill-warn">Preview</span> : null}
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
          <dt className="lbl-sm">Amount expected</dt>
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
        {row.rejectionReason ? (
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <dt className="lbl-sm">Rejected because</dt>
            <dd className="copy">{row.rejectionReason}</dd>
          </div>
        ) : null}
      </dl>

      {row.state === 'PENDING_VERIFICATION' ? (
        <div className="flex flex-col gap-3">
          <form action={verify}>
            <input type="hidden" name="passId" value={row.passId} />
            <button type="submit" className="btn btn-mint" disabled={busy}>
              VERIFY
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

      {row.state === 'ABANDONED' ? (
        <form action={reinstate} className="card-dash flex flex-wrap items-end gap-3 p-3">
          <input type="hidden" name="passId" value={row.passId} />
          <div className="fld min-w-0 flex-[1_1_220px]">
            <label htmlFor={`utr-${row.passId}`}>UTR the student sent</label>
            <input id={`utr-${row.passId}`} name="utr" className="inp inp-num" autoCapitalize="characters" pattern="[0-9A-Za-z ]{12,48}" maxLength={48} required />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            REINSTATE INTO THE QUEUE
          </button>
        </form>
      ) : null}

      <Status state={result} />
    </article>
  )
}
