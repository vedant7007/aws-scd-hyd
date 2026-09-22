import type { Metadata } from 'next'
import Link from 'next/link'
import { event, slots as fallbackSlots } from '@/content/event'
import { roomById, roomForTrackId } from '@/content/sessions'
import { tracks } from '@/content/tracks'
import { getConfig, getSessionsInSlot } from '@/lib/db/queries'
import type { Track } from '@/lib/db/types'
import { slotLabel, slotTime } from '@/lib/utils'

export const metadata: Metadata = {
  title: `Schedule, ${event.shortName}`,
  description: `The running order for ${event.name}, ${event.dateLabel}.`,
}

/** Seat counts move during the day, so this is never served stale. */
export const dynamic = 'force-dynamic'

/** The room a track runs in, once assigned. Never the buffer room: it is never assigned. */
function roomName(track: Track, assignment: Partial<Record<Track, string>>): string {
  return roomById(assignment[track])?.name ?? roomForTrackId(track)?.name ?? 'Room announced soon'
}

/**
 * One agenda card per track, a row per slot, the handoff's "your day" block
 * in page form. One markup for every width: the cards stack on a phone and
 * sit side by side on a laptop, so nothing scrolls sideways and assistive
 * tech sees one copy. Titles and speakers are TODO(vedant); a row says so
 * rather than showing a hole, and no time is printed until the organiser
 * sets one.
 */
export default async function SchedulePage() {
  const config = await getConfig()
  const slots = config?.slots ?? fallbackSlots
  const assignment = config?.roomForTrack ?? {}
  const sessionsPerSlot = await Promise.all(slots.map((s) => getSessionsInSlot(s.id)))
  const at = (slotIndex: number, track: Track) => sessionsPerSlot[slotIndex]?.find((s) => s.track === track)

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// THE PROGRAMME'}</span>
        <h1 className="h1">SCHEDULE</h1>
        <p className="lede">
          {event.dateLabel}. Three tracks run in parallel, one session each per slot. Times, titles and speakers go up here as they are
          confirmed.
        </p>
      </div>

      {slots.length === 0 ? (
        <div className="card-dash flex flex-col gap-2 p-4">
          <span className="lbl eye-amber">Not yet</span>
          <p className="copy">The running order is being confirmed and goes up here.</p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {tracks.map((track) => (
            <section key={track.id} className="ag-card" aria-labelledby={`track-${track.id}`}>
              <div className="ag-head">
                <span className="dot dot-round" data-track={track.id} aria-hidden="true" />
                <h2 id={`track-${track.id}`} className="ag-track">
                  {track.name.toUpperCase()}
                </h2>
                <span className="ag-room">{roomName(track.id, assignment)}</span>
              </div>
              {slots.map((slot, i) => {
                const session = at(i, track.id)
                const time = slotTime(slot)
                return (
                  <div key={slot.id} className="ag-row">
                    <span className="ag-time">
                      {slotLabel(slot, i)}
                      {time ? <span className="ag-time-tbc block">{time}</span> : null}
                    </span>
                    <span className="ag-cell">
                      <span className="ag-title">{session ? (session.title ?? 'Title announced soon') : 'Nothing scheduled'}</span>
                      <span className="ag-sub">{session ? (session.speaker ?? 'Speaker announced soon') : ''}</span>
                    </span>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}

      <div className="card-mint flex flex-col gap-3 p-4">
        <span className="h3">PICK YOUR SESSIONS AFTER YOU REGISTER</span>
        <p className="copy">One session per slot, from the tracks your pass covers. Your seat in each is held from the moment you save.</p>
        <Link href="/register" className="btn btn-primary self-start">
          REGISTER
        </Link>
      </div>
    </div>
  )
}
