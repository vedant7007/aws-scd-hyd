'use client'

import { useState } from 'react'
import type { SeatCount } from '@/lib/db/types'

export type PickerSession = {
  sessionId: string
  title: string
  speaker: string
  hallName: string
  seatsTaken: number
  capacity: number
}

export type PickerSlot = {
  slotId: string
  label: string
  sessions: PickerSession[]
}

type Props = {
  token: string
  slots: PickerSlot[]
  initialSelections: Record<string, string>
}

export function SessionPicker({ token, slots, initialSelections }: Props) {
  const [chosen, setChosen] = useState(initialSelections)
  const [seats, setSeats] = useState<Record<string, { seatsTaken: number; capacity: number }>>(() =>
    Object.fromEntries(
      slots.flatMap((slot) =>
        slot.sessions.map((s) => [s.sessionId, { seatsTaken: s.seatsTaken, capacity: s.capacity }]),
      ),
    ),
  )
  const [notice, setNotice] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  function applyCounts(fresh: SeatCount[] | undefined) {
    if (!fresh) return
    setSeats((prev) => {
      const next = { ...prev }
      for (const s of fresh) next[s.sessionId] = { seatsTaken: s.seatsTaken, capacity: s.capacity }
      return next
    })
  }

  async function pick(slotId: string, sessionId: string) {
    setBusy(sessionId)
    setNotice((n) => ({ ...n, [slotId]: '' }))

    try {
      const res = await fetch(`/api/pass/${token}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slotId, sessionId }),
      })
      const data = (await res.json()) as {
        ok: boolean
        message?: string
        sessions?: SeatCount[]
      }

      applyCounts(data.sessions)

      if (data.ok) {
        setChosen((c) => ({ ...c, [slotId]: sessionId }))
      } else {
        setNotice((n) => ({ ...n, [slotId]: data.message ?? 'That did not go through.' }))
      }
    } catch {
      setNotice((n) => ({
        ...n,
        [slotId]: 'That did not save. Check your connection and try again.',
      }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-12">
      {slots.map((slot) => (
        <section key={slot.slotId} aria-labelledby={`slot-${slot.slotId}`}>
          <h3 id={`slot-${slot.slotId}`} className="display text-step-2">
            {slot.label}
          </h3>

          {notice[slot.slotId] ? (
            <p role="status" className="mt-3 text-step--1 text-accent">
              {notice[slot.slotId]}
            </p>
          ) : null}

          <div className="mt-4">
            {slot.sessions.map((session) => {
              const count = seats[session.sessionId] ?? {
                seatsTaken: session.seatsTaken,
                capacity: session.capacity,
              }
              const left = count.capacity - count.seatsTaken
              const isChosen = chosen[slot.slotId] === session.sessionId
              const isFull = left <= 0 && !isChosen

              return (
                <button
                  key={session.sessionId}
                  type="button"
                  className="pick"
                  aria-pressed={isChosen}
                  disabled={isFull || busy !== null}
                  onClick={() => pick(slot.slotId, session.sessionId)}
                >
                  <span>
                    <span className="block text-step-1">{session.title}</span>
                    <span className="block text-step--1 text-muted">
                      {session.hallName}, {session.speaker}
                    </span>
                  </span>
                  <span className="mono text-step--1 whitespace-nowrap">
                    {isFull ? 'Hall full' : `${left} of ${count.capacity} left`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
