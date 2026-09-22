'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  changeSelectionAction,
  reinstateAction,
  rejectAction,
  releaseSessionsAction,
  resendSessionsLiveAction,
  verifyAction,
  type ActionState,
} from '@/app/admin/(secure)/actions'
import type { RegistrationState, Tier } from '@/lib/db/types'
import { REJECTION_REASONS, rejectionCodes } from '@/lib/registration/reasons'

export type Row = {
  passId: string
  name: string
  email: string
  college: string
  tier: Tier
  tierName: string
  trackName: string
  state: RegistrationState
  amountLabel: string
  earlyBird: boolean
  utr: string | null
  utrSubmittedAt: string | null
  screenshot: boolean
  rejectionReason: string | null
  createdAt: string
  /** Session ids held, by slot id. */
  held: Record<string, string>
  checkedIn: boolean
}

export type SessionOption = { sessionId: string; slotId: string; label: string }
export type SlotOption = { slotId: string; label: string; sessions: SessionOption[] }

type View = 'queue' | 'unselected' | 'all'

const STATES: RegistrationState[] = ['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'VERIFIED', 'SESSIONS_SELECTED', 'REJECTED', 'ABANDONED']

/** How a state reads: the word is the signal, the colour only repeats it. */
const STATE_LABEL: Record<RegistrationState, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PENDING_VERIFICATION: 'Pending verification',
  VERIFIED: 'Verified',
  SESSIONS_SELECTED: 'Sessions selected',
  REJECTED: 'Rejected',
  ABANDONED: 'Abandoned',
}
const STATE_PILL: Record<RegistrationState, string> = {
  AWAITING_PAYMENT: 'pill pill-ghost',
  PENDING_VERIFICATION: 'pill pill-warn',
  VERIFIED: 'pill',
  SESSIONS_SELECTED: 'pill',
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
 * Amendment 1 section 6. Default view is the verification queue, oldest
 * first. Counts for all six states. A filter for verified but unselected.
 * Search by pass id, UTR or email. Every row action posts to a server
 * action that resolves the admin and asserts the state.
 */
export function AdminConsole({ rows, slots, sessionsReleased }: { rows: Row[]; slots: SlotOption[]; sessionsReleased: boolean }) {
  const [view, setView] = useState<View>('queue')
  const [query, setQuery] = useState('')
  const [releaseState, release] = useActionState(async () => releaseSessionsAction(), null as ActionState)
  const [resendState, resend] = useActionState(async () => resendSessionsLiveAction(), null as ActionState)

  const counts = useMemo(() => Object.fromEntries(STATES.map((s) => [s, rows.filter((r) => r.state === s).length])), [rows])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[\s-]+/g, '')
    let list = rows
    if (q) {
      list = rows.filter((r) => r.passId.toLowerCase().replace(/-/g, '').includes(q) || (r.utr ?? '').includes(q) || r.email.toLowerCase().includes(q))
    } else if (view === 'queue') {
      list = rows.filter((r) => r.state === 'PENDING_VERIFICATION').sort((a, b) => (a.utrSubmittedAt ?? '').localeCompare(b.utrSubmittedAt ?? ''))
    } else if (view === 'unselected') {
      list = rows.filter((r) => r.state === 'VERIFIED').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return list
  }, [rows, view, query])

  const viewLabel: Record<View, string> = {
    queue: `Queue (${counts.PENDING_VERIFICATION})`,
    unselected: `Verified, no sessions (${counts.VERIFIED})`,
    all: `All (${rows.length})`,
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
            {shown.length} of {rows.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 border-b border-line-soft p-4">
          <input
            className="inp min-w-0 flex-[1_1_220px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pass ID, UTR or email"
            aria-label="Search by pass ID, UTR or email"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="View">
            {(['queue', 'unselected', 'all'] as View[]).map((v) => (
              <button key={v} type="button" className="tog tog-mono" onClick={() => setView(v)} aria-pressed={view === v && !query}>
                {viewLabel[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="notice-mint m-4">
          <span className="lbl text-mint-ink">Sessions {sessionsReleased ? 'are released' : 'not released yet'}</span>
          {sessionsReleased ? (
            <form action={resend}>
              <button type="submit" className="btn btn-sm">
                RE-RUN EMAIL 3 FOR ANYONE MISSED
              </button>
            </form>
          ) : (
            <form action={release}>
              <button type="submit" className="btn btn-primary btn-sm">
                RELEASE SESSIONS AND EMAIL EVERYONE VERIFIED
              </button>
            </form>
          )}
          <Status state={releaseState ?? resendState} />
        </div>

        {shown.length === 0 ? <p className="row-body">Nobody here.</p> : null}
        {shown.map((r) => (
          <RowCard key={r.passId} row={r} slots={slots} />
        ))}
      </div>
    </div>
  )
}

function RowCard({ row, slots }: { row: Row; slots: SlotOption[] }) {
  const [verifyState, verify, verifying] = useActionState(verifyAction, null)
  const [rejectState, reject, rejecting] = useActionState(rejectAction, null)
  const [reinstateState, reinstate, reinstating] = useActionState(reinstateAction, null)
  const [changeState, change, changing] = useActionState(changeSelectionAction, null)
  const result = verifyState ?? rejectState ?? reinstateState ?? changeState
  const busy = verifying || rejecting || reinstating || changing

  return (
    <article className="flex flex-col gap-3 border-t border-line-soft p-4" aria-label={`${row.name}, ${row.passId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="h3">{row.name}</span>
          <span className="num text-[12px] text-muted">
            {row.passId} · {row.email} · {row.college}
          </span>
        </div>
        <span className={STATE_PILL[row.state]}>{STATE_LABEL[row.state]}</span>
      </div>

      <dl className="grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <div className="flex flex-col gap-0.5">
          <dt className="lbl-sm">Tier · track</dt>
          <dd className="copy text-ink">
            {row.tierName} · {row.trackName}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="lbl-sm">Amount expected</dt>
          <dd className="num text-[15px] font-semibold text-ink">
            {row.amountLabel}
            {row.earlyBird ? <span className="lbl-sm"> early bird</span> : null}
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
        {row.state === 'SESSIONS_SELECTED' ? (
          <div className="flex flex-col gap-0.5 sm:col-span-3">
            <dt className="lbl-sm">Sessions</dt>
            <dd className="num text-[12px] text-ink">
              {slots.map((s) => row.held[s.slotId] ?? '?').join(' · ')}
              {row.checkedIn ? <span className="lbl-sm"> · checked in</span> : null}
            </dd>
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
            <input id={`utr-${row.passId}`} name="utr" className="inp inp-num" inputMode="numeric" pattern="\d{12}" maxLength={14} required />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            REINSTATE INTO THE QUEUE
          </button>
        </form>
      ) : null}

      {row.state === 'SESSIONS_SELECTED' ? (
        <details className="card-dash p-3">
          <summary className="lbl cursor-pointer py-2">Change sessions</summary>
          <form action={change} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="passId" value={row.passId} />
            {slots.map((s) => (
              <div key={s.slotId} className="fld min-w-0 flex-[1_1_200px]">
                <label htmlFor={`${row.passId}-${s.slotId}`}>{s.label}</label>
                <select id={`${row.passId}-${s.slotId}`} name={`slot:${s.slotId}`} className="inp" defaultValue={row.held[s.slotId] ?? ''}>
                  {s.sessions.map((o) => (
                    <option key={o.sessionId} value={o.sessionId}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button type="submit" className="btn" disabled={busy}>
              MOVE, IN ONE TRANSACTION
            </button>
          </form>
        </details>
      ) : null}

      <Status state={result} />
    </article>
  )
}
