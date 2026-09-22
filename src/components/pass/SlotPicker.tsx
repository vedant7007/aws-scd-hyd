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

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Amendment 2 sections 3, 4 and 7. One session per slot, all four submitted
 * together. Counts are the real remaining seats. A full session is disabled
 * and says so. If a session fills between render and submit, the server
 * says which one; the picker keeps every other choice, marks that one Full
 * with fresh counts, and asks for another. Choices are final once saved.
 *
 * Built for a phone: one column, a big tap target per session, and the slot
 * being chosen sits at the top of the screen when its heading is tapped.
 * The save button lives in the handoff's fixed bar at the foot, with the
 * running count beside it.
 */
export function SlotPicker({ passId, slots, allowedTracks }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, { seatsTaken: number; sellableCapacity: number | null }>>(() =>
    Object.fromEntries(slots.flatMap((s) => s.sessions.map((x) => [x.sessionId, { seatsTaken: x.seatsTaken, sellableCapacity: x.sellableCapacity }]))),
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [filled, setFilled] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const chosenCount = slots.filter((s) => picks[s.slotId]).length
  const complete = chosenCount === slots.length

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
    <>
      <div className="flex flex-col gap-[clamp(22px,5vh,36px)]">
        <div className="card-dash flex flex-col gap-1.5 px-4 py-3.5">
          <span className="lbl eye-amber">Your pass covers {allowedTracks}</span>
          <p className="copy">One session per slot, four in all. Choices are final once saved.</p>
        </div>
        {notice ? (
          <div role="alert" className="notice-err">
            <span className="notice-title">NOT SAVED YET</span>
            <p className="copy">{notice}</p>
          </div>
        ) : null}
        {slots.map((slot, i) => (
          <section key={slot.slotId} id={`slot-${slot.slotId}`} aria-labelledby={`slot-h-${slot.slotId}`} className="scroll-mt flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eye">
                SLOT {pad(i + 1)} OF {pad(slots.length)}
              </span>
              <span className="lbl">{slot.time ?? 'Time announced soon'}</span>
            </div>
            <h3 id={`slot-h-${slot.slotId}`} className="h1">
              {slot.label.toUpperCase()}
            </h3>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={slot.label}>
              {slot.sessions.map((session) => {
                const c = counts[session.sessionId] ?? session
                const left = remaining(c)
                const isFull = left <= 0
                const chosen = picks[slot.slotId] === session.sessionId
                const justFilled = filled === session.sessionId
                const disabled = isFull || !session.allowed || busy
                const mark = isFull ? (justFilled ? 'Just filled' : 'Full') : !session.allowed ? 'Not on your pass' : chosen ? 'Picked' : `${left} left`
                const tone = isFull ? 'err' : !session.allowed ? 'warn' : chosen ? 'ok' : left < 15 ? 'warn' : undefined
                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    className={session.allowed ? 'opt' : 'opt opt-soft'}
                    disabled={disabled}
                    data-full={isFull ? 'true' : undefined}
                    onClick={() => {
                      setFilled(null)
                      setPicks((p) => ({ ...p, [slot.slotId]: session.sessionId }))
                    }}
                  >
                    <span className="opt-row">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="dot" data-track={session.track} aria-hidden="true" />
                        <span className="opt-title">{session.title ?? `${session.trackName}, title announced soon`}</span>
                      </span>
                      <span className="opt-mark" data-tone={tone}>
                        {mark}
                      </span>
                    </span>
                    <span className="opt-note">
                      {session.title ? `${session.trackName}, ` : ''}
                      {session.roomName ?? 'room announced soon'}
                      {session.speaker ? `, ${session.speaker}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="bar-fixed">
        <div className="bar-fixed-in">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="bar-lbl">{complete ? 'All four chosen' : `${slots.length - chosenCount} still to pick`}</span>
            <span className="bar-val">
              {chosenCount} OF {slots.length}
            </span>
          </div>
          <button type="button" className="btn btn-primary" disabled={!complete || busy} onClick={submit}>
            {busy ? 'SAVING' : 'SAVE MY SESSIONS >'}
          </button>
        </div>
      </div>
    </>
  )
}
