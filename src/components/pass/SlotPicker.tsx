'use client'

import { useState } from 'react'
import type { SeatCount, Track } from '@/lib/db/types'

export type PickerSession = {
  sessionId: string
  track: Track
  trackName: string
  title: string | null
  speaker: string | null
  roomName: string | null
  seatsTaken: number
  sellableCapacity: number | null
  /** False when the tier does not cover this track. Rendered, never selectable. */
  allowed: boolean
}

export type PickerSlot = { slotId: string; label: string; time: string | null; sessions: PickerSession[] }

type Props = {
  passId: string
  slots: PickerSlot[]
  allowedTracks: string
}

type Result = { ok: true; passUrl: string } | { ok: false; message: string; field?: string; filled?: string; sessions?: SeatCount[] }

const remaining = (s: { seatsTaken: number; sellableCapacity: number | null }) =>
  s.sellableCapacity === null ? 0 : Math.max(0, s.sellableCapacity - s.seatsTaken)

/**
 * Amendment 2 sections 3, 4 and 7. One session per slot, all four submitted
 * together. Counts are the real remaining seats. A full session is disabled
 * and says so. If a session fills between render and submit, the server
 * says which one; the picker keeps every other choice, marks that one Full
 * with fresh counts, and asks for another. Choices are final once saved.
 *
 * Built for a phone: one column, a big tap target per session, and the slot
 * being chosen sits at the top of the screen when its heading is tapped.
 */
export function SlotPicker({ passId, slots, allowedTracks }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, { seatsTaken: number; sellableCapacity: number | null }>>(() =>
    Object.fromEntries(slots.flatMap((s) => s.sessions.map((x) => [x.sessionId, { seatsTaken: x.seatsTaken, sellableCapacity: x.sellableCapacity }]))),
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [filled, setFilled] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const complete = slots.every((s) => picks[s.slotId])

  async function submit() {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/pass/${passId}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ picks }),
      })
      const data = (await res.json()) as Result
      if (data.ok) {
        window.location.assign(data.passUrl)
        return
      }
      if (data.sessions) {
        setCounts((prev) => {
          const next = { ...prev }
          for (const s of data.sessions!) next[s.sessionId] = { seatsTaken: s.seatsTaken, sellableCapacity: s.sellableCapacity }
          return next
        })
      }
      if (data.filled) {
        // Drop only the pick that failed. Everything else stays chosen.
        setFilled(data.filled)
        setPicks((p) => Object.fromEntries(Object.entries(p).filter(([, id]) => id !== data.filled)))
        setNotice('That session just filled up, please pick another.')
      } else {
        setNotice(data.message)
      }
    } catch {
      setNotice('That did not save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="text-step--1 text-muted">Your pass covers {allowedTracks}. One session per slot, four in all. Choices are final once saved.</p>
      {notice ? (
        <p role="alert" className="notice">
          {notice}
        </p>
      ) : null}
      {slots.map((slot, i) => (
        <section key={slot.slotId} id={`slot-${slot.slotId}`} aria-labelledby={`slot-h-${slot.slotId}`} style={{ scrollMarginTop: '12rem' }}>
          <h3 id={`slot-h-${slot.slotId}`} className="display text-step-2">
            <span className="numeral text-muted">{i + 1}/4</span> {slot.label}
            {slot.time ? <span className="numeral text-step-0 text-muted"> {slot.time}</span> : null}
          </h3>
          <div className="mt-4" role="radiogroup" aria-label={slot.label}>
            {slot.sessions.map((session) => {
              const c = counts[session.sessionId] ?? session
              const left = remaining(c)
              const isFull = left <= 0
              const chosen = picks[slot.slotId] === session.sessionId
              const justFilled = filled === session.sessionId
              const disabled = isFull || !session.allowed || busy
              return (
                <button
                  key={session.sessionId}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  className="pick"
                  disabled={disabled}
                  data-full={isFull ? 'true' : undefined}
                  onClick={() => {
                    setFilled(null)
                    setPicks((p) => ({ ...p, [slot.slotId]: session.sessionId }))
                  }}
                >
                  <span>
                    <span className="block text-step-1">{session.title ?? `${session.trackName}, title announced soon`}</span>
                    <span className="block text-step--1 text-muted">
                      {session.title ? `${session.trackName}, ` : ''}
                      {session.roomName ?? 'room announced soon'}
                      {session.speaker ? `, ${session.speaker}` : ''}
                      {!session.allowed ? ', not on your pass' : ''}
                    </span>
                  </span>
                  <span className="mono text-step--1 whitespace-nowrap">
                    {isFull ? (justFilled ? 'Just filled' : 'Full') : `${left} left`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      <div className="reg-actions">
        <button type="button" className="cta" disabled={!complete || busy} onClick={submit}>
          {busy ? 'Saving' : complete ? 'Save my four sessions' : `${slots.filter((s) => picks[s.slotId]).length} of 4 chosen`}
        </button>
      </div>
    </div>
  )
}
