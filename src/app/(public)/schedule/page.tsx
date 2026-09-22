import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Container } from '@/components/layout/Container'
import { event, slots as fallbackSlots } from '@/content/event'
import { roomById, roomForTrackId } from '@/content/sessions'
import { tracks } from '@/content/tracks'
import { getConfig, getSessionsInSlot } from '@/lib/db/queries'
import type { Session, Track } from '@/lib/db/types'
import { slotTime } from '@/lib/utils'

export const metadata: Metadata = {
  title: `Schedule, ${event.shortName}`,
  description: `The running order for ${event.name}, ${event.dateLabel}.`,
}

/** Seat counts move during the day, so this is never served stale. */
export const dynamic = 'force-dynamic'

/** Titles and speakers are TODO(vedant); a cell says so rather than showing a hole. */
function Cell({ session }: { session: Session | undefined }) {
  if (!session) return <p className="text-muted">Nothing scheduled</p>
  return (
    <>
      <p className="agenda-title">{session.title ?? 'Title announced soon'}</p>
      <p className="agenda-speaker">{session.speaker ?? 'Speaker announced soon'}</p>
    </>
  )
}

/** The room a track runs in, once assigned. Never the buffer room: it is never assigned. */
function roomName(track: Track, assignment: Partial<Record<Track, string>>): string {
  return roomById(assignment[track])?.name ?? roomForTrackId(track)?.name ?? 'Room announced soon'
}

export default async function SchedulePage() {
  const config = await getConfig()
  const slots = config?.slots ?? fallbackSlots
  const assignment = config?.roomForTrack ?? {}
  const sessionsPerSlot = await Promise.all(slots.map((s) => getSessionsInSlot(s.id)))

  const at = (slotIndex: number, track: Track) => sessionsPerSlot[slotIndex]?.find((s) => s.track === track)

  return (
    <Container className="section-tight flex flex-col gap-12">
      <div className="field-grid">
        <h1 className="display text-step-4 col-span-full lg:col-span-7">Schedule</h1>
        <p className="measure text-step-1 text-muted col-span-full lg:col-span-4 lg:col-start-9 lg:self-end">
          {event.dateLabel}. Three tracks run in parallel, one session each per slot. Times, titles and speakers go up
          here as they are confirmed.
        </p>
      </div>

      {slots.length === 0 ? (
        <p className="measure text-muted">The running order is being confirmed and goes up here.</p>
      ) : (
        <>
          {/*
            Wide screens get the grid: slots down the left, tracks across, the
            room named under each track once it has one. Narrow screens get one
            vertical list per track. Two blocks rather than one table that
            scrolls sideways, which is unusable at a venue. Only one is ever
            displayed, so assistive tech sees one copy.
          */}
          <div className="schedule-wide">
            <div
              className="agenda"
              style={{ '--hall-count': tracks.length } as CSSProperties}
              role="table"
              aria-label="Sessions by slot and track"
            >
              <div role="row" style={{ display: 'contents' }}>
                <span role="columnheader" className="agenda-head">
                  Slot
                </span>
                {tracks.map((track) => (
                  <span role="columnheader" key={track.id} className="agenda-head">
                    {track.name}
                    <br />
                    <span className="text-muted">{roomName(track.id, assignment)}</span>
                  </span>
                ))}
              </div>

              {slots.map((slot, i) => (
                <div role="row" key={slot.id} style={{ display: 'contents' }}>
                  <span role="rowheader" className="agenda-time">
                    {slot.label}
                    <br />
                    {slotTime(slot) ?? 'Time to be confirmed'}
                  </span>
                  {tracks.map((track) => {
                    const session = at(i, track.id)
                    return (
                      <div role="cell" key={track.id} className="agenda-cell" data-track={track.id}>
                        <Cell session={session} />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="schedule-stack flex flex-col gap-12">
            {tracks.map((track) => (
              <section key={track.id} aria-labelledby={`track-${track.id}`}>
                <h2 id={`track-${track.id}`} className="display text-step-2">
                  {track.name}
                </h2>
                <p className="text-step--1 text-muted">{roomName(track.id, assignment)}</p>
                <ul className="mt-4">
                  {slots.map((slot, i) => {
                    const session = at(i, track.id)
                    return (
                      <li key={slot.id} className="agenda-cell" data-track={track.id}>
                        <p className="numeral">
                          {slot.label}
                          {slotTime(slot) ? `, ${slotTime(slot)}` : ''}
                        </p>
                        <div className="mt-1">
                          <Cell session={session} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </Container>
  )
}
