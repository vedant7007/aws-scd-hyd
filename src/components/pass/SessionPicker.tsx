'use client'

import { useState } from 'react'
import type { SeatCount } from '@/lib/db/types'

export type PickerSession = {
  sessionId: string
  /** Null until the line-up is announced. */
  title: string | null
  speaker: string | null
  trackName: string
  /** Null until the track has a room. */
  roomName: string | null
  /** True when this pass holds a seat in it. */
  held: boolean
}

export type PickerSlot = {
  slotId: string
  label: string
  /** Null until times are decided. */
  time: string | null
  sessions: PickerSession[]
}

type Props = {
  token: string
  slots: PickerSlot[]
  /** SHIPS LATER: once true, and the pass holds more than one track, a slot can be narrowed to one session. */
  refinementOpen: boolean
}

/**
 * What the pass holds, slot by slot. A seat is held in every session of every
 * track on the pass; with refinement off that is all this shows. With it on,
 * a slot with more than one held session gets a choice, and choosing one
 * releases the others for good.
 */
export function SessionPicker({ token, slots, refinementOpen }: Props) {
  const [heldIds, setHeldIds] = useState<Set<string>>(
    () => new Set(slots.flatMap((s) => s.sessions.filter((x) => x.held).map((x) => x.sessionId))),
  )
  const [notice, setNotice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function keep(slotId: string, sessionId: string) {
    setBusy(sessionId)
    setNotice((n) => ({ ...n, [slotId]: '' }))
    try {
      const res = await fetch(`/api/pass/${token}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slotId, sessionId }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string; sessions?: SeatCount[] }
      if (data.ok) {
        setHeldIds((prev) => {
          const next = new Set(prev)
          for (const s of slots.find((x) => x.slotId === slotId)?.sessions ?? []) if (s.sessionId !== sessionId) next.delete(s.sessionId)
          return next
        })
      } else {
        setNotice((n) => ({ ...n, [slotId]: data.message ?? 'That did not go through.' }))
      }
    } catch {
      setNotice((n) => ({ ...n, [slotId]: 'That did not save. Check your connection and try again.' }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-12">
      {slots.map((slot) => {
        const held = slot.sessions.filter((s) => heldIds.has(s.sessionId))
        const canRefine = refinementOpen && held.length > 1
        return (
          <section key={slot.slotId} aria-labelledby={`slot-${slot.slotId}`}>
            <h3 id={`slot-${slot.slotId}`} className="display text-step-2">
              {slot.label}
              {slot.time ? <span className="numeral text-step-0 text-muted"> {slot.time}</span> : null}
            </h3>

            {notice[slot.slotId] ? (
              <p role="status" className="mt-3 text-step--1 text-accent">
                {notice[slot.slotId]}
              </p>
            ) : null}

            <div className="mt-4">
              {held.map((session) =>
                canRefine ? (
                  <button
                    key={session.sessionId}
                    type="button"
                    className="pick"
                    disabled={busy !== null}
                    onClick={() => keep(slot.slotId, session.sessionId)}
                  >
                    <Body session={session} />
                    <span className="mono text-step--1 whitespace-nowrap">Keep this one</span>
                  </button>
                ) : (
                  <div key={session.sessionId} className="pick" aria-current={held.length === 1 ? 'true' : undefined}>
                    <Body session={session} />
                    <span className="mono text-step--1 whitespace-nowrap">Seat held</span>
                  </div>
                ),
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Body({ session }: { session: PickerSession }) {
  return (
    <span>
      <span className="block text-step-1">{session.title ?? `${session.trackName}, title announced soon`}</span>
      <span className="block text-step--1 text-muted">
        {session.title ? `${session.trackName}, ` : ''}
        {session.roomName ?? 'room announced soon'}
        {session.speaker ? `, ${session.speaker}` : ''}
      </span>
    </span>
  )
}
