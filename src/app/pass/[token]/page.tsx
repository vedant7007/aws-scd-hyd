import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { QrPass } from '@/components/pass/QrPass'
import { SessionPicker, type PickerSlot } from '@/components/pass/SessionPicker'
import { event, halls, slots as fallbackSlots, venue } from '@/content/event'
import { getAttendeeByToken, getAttendeeWithSelections, getConfig, getSessionsInSlot } from '@/lib/db/queries'

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

  const [config, { selections }] = await Promise.all([
    getConfig(),
    getAttendeeWithSelections(attendee.ticketRef),
  ])

  // Halls and slots are config, never hardcoded, see SPEC.md section 6.
  const slotList = config?.slots ?? fallbackSlots
  const hallNames = new Map((config?.halls ?? halls).map((h) => [h.id, h.name]))

  const slotSessions = await Promise.all(slotList.map((slot) => getSessionsInSlot(slot.id)))

  const pickerSlots: PickerSlot[] = slotList.map((slot, i) => ({
    slotId: slot.id,
    label: slot.label,
    sessions: slotSessions[i].map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      speaker: s.speaker,
      hallName: hallNames.get(s.hallId) ?? s.hallId,
      seatsTaken: s.seatsTaken,
      capacity: s.capacity,
    })),
  }))

  const initialSelections = Object.fromEntries(selections.map((s) => [s.slotId, s.sessionId]))

  return (
    <Container className="flex flex-col gap-16 py-16">
      <header className="flex flex-col gap-8">
        <div>
          <p className="text-step--1 text-muted">{event.shortName}</p>
          <h1 className="display text-step-4">{attendee.name}</h1>
        </div>

        <QrPass ticketRef={attendee.ticketRef} />

        <dl className="flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <dt className="text-step--1 text-muted">Pass</dt>
            <dd className="text-step-1">{attendee.tier}</dd>
          </div>
          <div>
            <dt className="text-step--1 text-muted">Ticket</dt>
            <dd className="mono text-step-1">{attendee.ticketRef}</dd>
          </div>
          <div>
            <dt className="text-step--1 text-muted">Food</dt>
            <dd className="text-step-1">{attendee.foodPreference}</dd>
          </div>
        </dl>

        <p className="measure text-muted">
          {event.dateLabel}, {venue.name}. Show this code at the gate.
        </p>
      </header>

      <section aria-labelledby="picker-heading" className="border-t border-border pt-12">
        <h2 id="picker-heading" className="display text-step-3">
          Your sessions
        </h2>
        <p className="measure mt-4 text-muted">
          One session per slot. Seats are limited per hall, so a hall can fill up while you are deciding.
        </p>
        <div className="mt-10">
          <SessionPicker token={token} slots={pickerSlots} initialSelections={initialSelections} />
        </div>
      </section>
    </Container>
  )
}
