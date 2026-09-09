import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Container } from '@/components/layout/Container'
import { event, halls as fallbackHalls, slots as fallbackSlots } from '@/content/event'
import { getConfig, getSessionsInSlot } from '@/lib/db/queries'
import type { Session } from '@/lib/db/types'

export const metadata: Metadata = {
  title: `Schedule, ${event.shortName}`,
  description: `The running order for ${event.name}, ${event.dateLabel}.`,
}

/** Seat counts move during the day, so this is never served stale. */
export const dynamic = 'force-dynamic'

function Cell({ session }: { session: Session | undefined }) {
  if (!session) return <p className="text-muted">Nothing scheduled</p>
  return (
    <>
      <p className="agenda-title">{session.title}</p>
      <p className="agenda-speaker">{session.speaker}</p>
    </>
  )
}

export default async function SchedulePage() {
  const config = await getConfig()
  const slots = config?.slots ?? fallbackSlots
  const halls = config?.halls ?? fallbackHalls
  const sessionsPerSlot = await Promise.all(slots.map((s) => getSessionsInSlot(s.id)))

  const at = (slotIndex: number, hallId: string) =>
    sessionsPerSlot[slotIndex]?.find((s) => s.hallId === hallId)

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    })

  return (
    <Container className="section-tight flex flex-col gap-12">
      <div className="field-grid">
        <h1 className="display text-step-4 col-span-full lg:col-span-7">Schedule</h1>
        <p className="measure text-step-1 text-muted col-span-full lg:col-span-4 lg:col-start-9 lg:self-end">
          {event.dateLabel}. Times are IST. You pick one session per slot from your pass.
        </p>
      </div>

      {slots.length === 0 || halls.length === 0 ? (
        <p className="measure text-muted">The running order is being confirmed and goes up here.</p>
      ) : (
        <>
          {/*
            Wide screens get the real agenda: time down the left, halls across,
            each cell carrying a rail whose weight says which track it is.
            Narrow screens get one vertical list per hall. Two blocks rather
            than one table that scrolls sideways, which is unusable at a venue.
            Only one is ever displayed, so assistive tech sees one copy.
          */}
          <div className="schedule-wide">
            <div
              className="agenda"
              style={{ '--hall-count': halls.length } as CSSProperties}
              role="table"
              aria-label="Sessions by time and hall"
            >
              <div role="row" style={{ display: 'contents' }}>
                <span role="columnheader" className="agenda-head">
                  Time
                </span>
                {halls.map((hall) => (
                  <span role="columnheader" key={hall.id} className="agenda-head">
                    {hall.name}
                  </span>
                ))}
              </div>

              {slots.map((slot, i) => (
                <div role="row" key={slot.id} style={{ display: 'contents' }}>
                  <span role="rowheader" className="agenda-time">
                    {time(slot.startsAt)}
                    <br />
                    {time(slot.endsAt)}
                  </span>
                  {halls.map((hall) => {
                    const session = at(i, hall.id)
                    return (
                      <div
                        role="cell"
                        key={hall.id}
                        className="agenda-cell"
                        data-track={session?.track}
                      >
                        <Cell session={session} />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="schedule-stack flex flex-col gap-12">
            {halls.map((hall) => (
              <section key={hall.id} aria-labelledby={`hall-${hall.id}`}>
                <h2 id={`hall-${hall.id}`} className="display text-step-2">
                  {hall.name}
                </h2>
                <ul className="mt-4">
                  {slots.map((slot, i) => {
                    const session = at(i, hall.id)
                    return (
                      <li key={slot.id} className="agenda-cell" data-track={session?.track}>
                        <p className="numeral">
                          {time(slot.startsAt)} to {time(slot.endsAt)}
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
