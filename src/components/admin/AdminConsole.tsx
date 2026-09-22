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
} from '@/app/(site)/admin/(secure)/actions'
import type { RegistrationState } from '@/lib/db/types'

export type Row = {
  passId: string
  name: string
  email: string
  college: string
  tierName: string
  trackName: string
  state: RegistrationState
  amountLabel: string
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

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '')

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

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STATES.map((s) => (
          <div key={s} className="stat">
            <dt className="text-step--1 text-muted">{s.replace('_', ' ').toLowerCase()}</dt>
            <dd className="display text-step-2">{counts[s]}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="View">
          {(['queue', 'unselected', 'all'] as View[]).map((v) => (
            <button key={v} type="button" className={view === v && !query ? 'cta' : 'cta-quiet'} onClick={() => setView(v)} aria-pressed={view === v}>
              {v === 'queue' ? `Verification queue (${counts.PENDING_VERIFICATION})` : v === 'unselected' ? `Verified, no sessions (${counts.VERIFIED})` : `All (${rows.length})`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-step--1">
          <span className="text-muted">Search</span>
          <input className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="pass ID, UTR or email" aria-label="Search by pass ID, UTR or email" />
        </label>
      </div>

      <div className="notice flex flex-wrap items-center gap-3">
        <span className="font-semibold">Sessions {sessionsReleased ? 'are released' : 'not released yet'}.</span>
        {sessionsReleased ? (
          <form action={resend}>
            <button type="submit" className="cta-quiet">Re-run email 3 for anyone missed</button>
          </form>
        ) : (
          <form action={release}>
            <button type="submit" className="cta">Release sessions and email every verified attendee</button>
          </form>
        )}
        {(releaseState ?? resendState) ? <span className="text-step--1 text-muted">{(releaseState ?? resendState)!.message}</span> : null}
      </div>

      {shown.length === 0 ? <p className="text-muted">Nothing here.</p> : null}
      <ul className="flex flex-col gap-4">
        {shown.map((r) => (
          <li key={r.passId} className="scan-card">
            <RowCard row={r} slots={slots} />
          </li>
        ))}
      </ul>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="display text-step-1">{row.name}</p>
          <p className="text-step--1 text-muted">
            {row.email} · {row.college}
          </p>
        </div>
        <p className="mono text-step--1">
          {row.passId} · <span className="badge">{row.state}</span>
        </p>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-step--1 sm:grid-cols-3">
        <div>
          <dt className="text-muted">Tier · track</dt>
          <dd>
            {row.tierName} · {row.trackName}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Amount expected</dt>
          <dd className="numeral">{row.amountLabel}</dd>
        </div>
        <div>
          <dt className="text-muted">UTR</dt>
          <dd className="numeral">
            {row.utr ?? '—'}
            {row.utrSubmittedAt ? <span className="text-muted"> at {when(row.utrSubmittedAt)}</span> : null}
          </dd>
        </div>
        {row.screenshot ? (
          <div>
            <dt className="text-muted">Screenshot</dt>
            <dd>
              <a className="link" href={`/admin/screenshot/${row.passId}`} target="_blank" rel="noopener">
                Open (60 second link)
              </a>
            </dd>
          </div>
        ) : null}
        {row.rejectionReason ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">Rejected because</dt>
            <dd>{row.rejectionReason}</dd>
          </div>
        ) : null}
        {row.state === 'SESSIONS_SELECTED' ? (
          <div className="sm:col-span-3">
            <dt className="text-muted">Sessions</dt>
            <dd className="mono">{slots.map((s) => row.held[s.slotId] ?? '?').join(' · ')}</dd>
          </div>
        ) : null}
      </dl>

      {row.state === 'PENDING_VERIFICATION' ? (
        <div className="flex flex-wrap items-end gap-3">
          <form action={verify}>
            <input type="hidden" name="passId" value={row.passId} />
            <button type="submit" className="cta" disabled={busy}>
              Verify
            </button>
          </form>
          <form action={reject} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="passId" value={row.passId} />
            <label className="flex flex-col text-step--1">
              <span className="text-muted">Reason for the student</span>
              <input name="reason" className="field" maxLength={300} placeholder="No payment with this UTR in the statement" />
            </label>
            <button type="submit" className="cta-quiet" disabled={busy}>
              Reject
            </button>
          </form>
        </div>
      ) : null}

      {row.state === 'ABANDONED' ? (
        <form action={reinstate} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="passId" value={row.passId} />
          <label className="flex flex-col text-step--1">
            <span className="text-muted">UTR the student sent</span>
            <input name="utr" className="field numeral" inputMode="numeric" pattern="\d{12}" maxLength={14} required />
          </label>
          <button type="submit" className="cta-quiet" disabled={busy}>
            Reinstate into the queue
          </button>
        </form>
      ) : null}

      {row.state === 'SESSIONS_SELECTED' ? (
        <details>
          <summary className="cursor-pointer text-step--1">Change sessions</summary>
          <form action={change} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="passId" value={row.passId} />
            {slots.map((s) => (
              <label key={s.slotId} className="flex flex-col text-step--1">
                <span className="text-muted">{s.label}</span>
                <select name={`slot:${s.slotId}`} className="field" defaultValue={row.held[s.slotId] ?? ''}>
                  {s.sessions.map((o) => (
                    <option key={o.sessionId} value={o.sessionId}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="submit" className="cta-quiet" disabled={busy}>
              Move, releasing and claiming in one transaction
            </button>
          </form>
        </details>
      ) : null}

      {result ? (
        <p role="status" className={result.ok ? 'text-step--1' : 'reg-error'}>
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
