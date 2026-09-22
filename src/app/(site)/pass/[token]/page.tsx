import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { QrPass } from '@/components/pass/QrPass'
import { SessionPicker, type PickerSlot } from '@/components/pass/SessionPicker'
import { event, sessionRefinementOpen, slots as fallbackSlots, venue } from '@/content/event'
import { tierLabel } from '@/content/passes'
import { roomById, trackName } from '@/content/sessions'
import { getAttendeeByToken, getAttendeeWithSeats, getConfig, getSessionsInSlot } from '@/lib/db/queries'
import { slotTime } from '@/lib/utils'

/** A pass link is private. It must never be indexed or appear in the sitemap. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/** Token lookups hit the table on every request, never a cached render. */
export const dynamic = 'force-dynamic'

export default async function PassPage({ params }: PageProps<'/pass/[token]'>) {
  const { token } = await params

  const attendee = await getAttendeeByToken(token)
  // Renders not-found.tsx in this segment, with a 404 rather than a 200.
  if (!attendee) notFound()

  const [config, { seats }] = await Promise.all([getConfig(), getAttendeeWithSeats(attendee.ticketRef)])

  // Slots are config, never hardcoded. Rooms come from the track assignment.
  const slotList = config?.slots ?? fallbackSlots
  const refinementOpen = config?.sessionRefinementOpen ?? sessionRefinementOpen
  const heldIds = new Set(seats.map((s) => s.sessionId))

  const slotSessions = await Promise.all(slotList.map((slot) => getSessionsInSlot(slot.id)))

  const pickerSlots: PickerSlot[] = slotList.map((slot, i) => ({
    slotId: slot.id,
    label: slot.label,
    time: slotTime(slot),
    sessions: slotSessions[i]
      .filter((s) => heldIds.has(s.sessionId))
      .map((s) => ({
        sessionId: s.sessionId,
        title: s.title,
        speaker: s.speaker,
        trackName: trackName(s.track),
        roomName: roomById(s.roomId)?.name ?? null,
        held: true,
      })),
  }))

  return (
    <Container className="section-tight flex flex-col gap-16">
      {/*
        Built as an object rather than a page header, because this is the thing
        students screenshot: a bordered ticket with a tear line, the code on a
        fixed light plate, and the facts set as a row you can read at a glance.
      */}
      <article className="ticket enter">
        <div className="ticket-head">
          <div>
            <p className="eyebrow">{event.shortName}</p>
            <h1 className="ticket-name mt-1">{attendee.name}</h1>
          </div>
          <span className="badge">{tierLabel(attendee.tier)}</span>
        </div>

        <QrPass ticketRef={attendee.ticketRef} />

        <div className="ticket-tear" />

        <dl className="ticket-facts">
          <div className="ticket-fact">
            <dt>Ticket</dt>
            <dd className="numeral">{attendee.ticketRef}</dd>
          </div>
          <div className="ticket-fact">
            <dt>Food</dt>
            <dd>{attendee.foodPreference}</dd>
          </div>
          <div className="ticket-fact">
            <dt>{attendee.tracks.length === 1 ? 'Track' : 'Tracks'}</dt>
            <dd>{attendee.tracks.map(trackName).join(', ')}</dd>
          </div>
          <div className="ticket-fact">
            <dt>Date</dt>
            <dd>{event.dateLabel}</dd>
          </div>
        </dl>

        <p className="text-step--1 text-muted">
          {venue.name}. Show this code at the gate.
        </p>
      </article>

      <p>
        <Link className="cta-quiet" href={`/pass/${token}/share`}>
          Tell people you are going
        </Link>
      </p>

      <section aria-labelledby="picker-heading" className="rule-top pt-12">
        <h2 id="picker-heading" className="display text-step-3">
          Your sessions
        </h2>
        <p className="measure mt-4 text-muted">
          {refinementOpen && attendee.tracks.length > 1
            ? 'Your pass holds a seat in every session of each of your tracks. Where two clash, keep the one you want and the other seat goes back.'
            : 'A seat is held for you in every session of your track. Titles and speakers are announced closer to the day.'}
        </p>
        <div className="mt-10">
          <SessionPicker token={token} slots={pickerSlots} refinementOpen={refinementOpen} />
        </div>
      </section>
    </Container>
  )
}
