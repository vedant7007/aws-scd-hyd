import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { QrPass } from '@/components/pass/QrPass'
import { SlotPicker, type PickerSlot } from '@/components/pass/SlotPicker'
import { event, slots as fallbackSlots, venue } from '@/content/event'
import { tierLabel, tracksAllowedFor } from '@/content/passes'
import { roomById, trackName } from '@/content/sessions'
import { tracks } from '@/content/tracks'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee, getAttendeeWithSeats, getConfig, getSessionsInSlot } from '@/lib/db/queries'
import { REPLY_TO } from '@/lib/email/templates'
import { sessionsAreReleased } from '@/lib/registration/flow'
import { slotTime } from '@/lib/utils'

/** A pass is private. It must never be indexed or appear in the sitemap. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/** Lookups hit the table on every request, never a cached render. */
export const dynamic = 'force-dynamic'

/**
 * Amendment 1 section 4, the state table.
 *
 *   AWAITING_PAYMENT, PENDING_VERIFICATION, ABANDONED, REJECTED, unknown
 *       the same not-found page, so nothing about the record leaks
 *   VERIFIED, sessions not released
 *       name, pass id, tier, home track, "agenda coming soon". No QR.
 *   VERIFIED, sessions released
 *       the per-slot picker. Still no QR.
 *   SESSIONS_SELECTED
 *       the full pass: QR, the four sessions, food. Read only.
 */
export default async function PassPage({ params }: PageProps<'/pass/[passId]'>) {
  const { passId: raw } = await params
  const canonical = normalisePassId(raw)
  if (!canonical) notFound()
  // One URL per pass. A lowercase or unhyphenated link lands on the real one.
  if (canonical !== raw) redirect(`/pass/${canonical}`)

  // By key, strongly consistent: a student opening the link the second after a verify sees VERIFIED, not the index catching up.
  const attendee = await getAttendee(canonical)
  if (!attendee || (attendee.state !== 'VERIFIED' && attendee.state !== 'SESSIONS_SELECTED')) notFound()

  const [config, released] = await Promise.all([getConfig(), sessionsAreReleased()])
  const slotList = config?.slots ?? fallbackSlots
  const allowed = tracksAllowedFor(attendee.tier)
  const allowedTracks =
    allowed >= tracks.length
      ? 'all three tracks'
      : allowed === 1
        ? `the ${trackName(attendee.homeTrack)} track`
        : `${trackName(attendee.homeTrack)} plus one other track`

  const facts = (
    <dl className="ticket-facts">
      <div className="ticket-fact">
        <dt>Pass ID</dt>
        <dd className="numeral">{attendee.passId}</dd>
      </div>
      <div className="ticket-fact">
        <dt>Pass</dt>
        <dd>{tierLabel(attendee.tier)}</dd>
      </div>
      <div className="ticket-fact">
        <dt>Track</dt>
        <dd>{trackName(attendee.homeTrack)}</dd>
      </div>
      <div className="ticket-fact">
        <dt>Date</dt>
        <dd>{event.dateLabel}</dd>
      </div>
    </dl>
  )

  if (attendee.state === 'VERIFIED') {
    if (!released) {
      return (
        <Container className="section-tight flex flex-col gap-10">
          <article className="ticket enter">
            <div className="ticket-head">
              <div>
                <p className="eyebrow">{event.shortName}</p>
                <h1 className="ticket-name mt-1">{attendee.name}</h1>
              </div>
              <span className="badge">{tierLabel(attendee.tier)}</span>
            </div>
            {facts}
            <p className="measure text-muted">Agenda coming soon. We will email you when you can pick your sessions.</p>
          </article>
        </Container>
      )
    }

    const slotSessions = await Promise.all(slotList.map((slot) => getSessionsInSlot(slot.id)))
    const order = (t: string) => tracks.findIndex((x) => x.id === t)
    const pickerSlots: PickerSlot[] = slotList.map((slot, i) => ({
      slotId: slot.id,
      label: slot.label,
      time: slotTime(slot),
      sessions: [...slotSessions[i]!]
        .sort((a, b) => order(a.track) - order(b.track))
        .map((s) => ({
          sessionId: s.sessionId,
          track: s.track,
          trackName: trackName(s.track),
          title: s.title,
          speaker: s.speaker,
          roomName: roomById(s.roomId)?.name ?? null,
          seatsTaken: s.seatsTaken,
          sellableCapacity: s.sellableCapacity,
          // Regular: home track only. Premium: any track, one other, held at submit. Platinum, VIP: all.
          allowed: allowed > 1 || s.track === attendee.homeTrack,
        })),
    }))

    return (
      <Container className="section-tight flex flex-col gap-10">
        <div>
          <p className="eyebrow">{event.shortName}</p>
          <h1 className="display text-step-3 mt-2">{attendee.name}, choose your sessions</h1>
          <p className="numeral mt-2 text-muted">{attendee.passId}</p>
        </div>
        <SlotPicker passId={attendee.passId} slots={pickerSlots} allowedTracks={allowedTracks} />
      </Container>
    )
  }

  // SESSIONS_SELECTED: the finished pass.
  const [{ seats }, ...slotSessions] = await Promise.all([
    getAttendeeWithSeats(attendee.passId),
    ...slotList.map((s) => getSessionsInSlot(s.id)),
  ])
  const chosen = slotList.map((slot, i) => {
    const seat = seats.find((s) => s.slotId === slot.id)
    return { slot, session: seat ? slotSessions[i]!.find((s) => s.sessionId === seat.sessionId) : undefined }
  })

  return (
    <Container className="section-tight flex flex-col gap-12">
      <article className="ticket enter">
        <div className="ticket-head">
          <div>
            <p className="eyebrow">{event.shortName}</p>
            <h1 className="ticket-name mt-1">{attendee.name}</h1>
          </div>
          <span className="badge">{tierLabel(attendee.tier)}</span>
        </div>
        <QrPass passId={attendee.passId} />
        <div className="ticket-tear" />
        {facts}
        <dl className="ticket-facts">
          <div className="ticket-fact">
            <dt>Food</dt>
            <dd>{attendee.foodPreference}</dd>
          </div>
        </dl>
        <p className="text-step--1 text-muted">{venue.name}. Show this code at the gate.</p>
      </article>

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="display text-step-3">
          Your sessions
        </h2>
        <ul className="mt-6 flex flex-col gap-4">
          {chosen.map(({ slot, session }) => (
            <li key={slot.id} className="pick" aria-current="true">
              <span>
                <span className="block text-step--1 text-muted">
                  {slot.label}
                  {slotTime(slot) ? `, ${slotTime(slot)}` : ''}
                </span>
                <span className="block text-step-1">
                  {session ? (session.title ?? `${trackName(session.track)}, title announced soon`) : 'Session missing, write to us'}
                </span>
                <span className="block text-step--1 text-muted">
                  {session ? `${trackName(session.track)}, ${roomById(session.roomId)?.name ?? 'room announced soon'}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="measure mt-6 text-step--1 text-muted">
          Your choices are saved and cannot be changed here. If you need a change, write to the organisers at {REPLY_TO}{' '}
          quoting your pass ID.
        </p>
      </section>
    </Container>
  )
}
