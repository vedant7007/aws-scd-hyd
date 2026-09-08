import type { Metadata } from 'next'
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
      <p className="text-step-1">{session.title}</p>
      <p className="text-step--1 text-muted">{session.speaker}</p>
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
    <Container className="flex flex-col gap-12 py-16">
      <div>
        <h1 className="display text-step-4">Schedule</h1>
        <p className="measure mt-4 text-step-1 text-muted">
          {event.dateLabel}. Times are IST. You pick one session per slot from your pass.
        </p>
      </div>

      {slots.length === 0 || halls.length === 0 ? (
        <p className="measure text-muted">The running order is being confirmed and goes up here.</p>
      ) : (
        <>
          {/*
            Wide screens: time down, halls across. Narrow screens: one vertical
            list per hall. Two blocks rather than one scrolling table, because a
            schedule that scrolls sideways on a phone is unusable at a venue.
            Only one is ever displayed, so assistive tech sees one copy.
          */}
          <div className="schedule-wide">
            <table className="data-table">
              <caption className="sr-only">Sessions by time and hall</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  {halls.map((hall) => (
                    <th key={hall.id} scope="col">
                      {hall.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, i) => (
                  <tr key={slot.id}>
                    <th scope="row" className="mono whitespace-nowrap">
                      {time(slot.startsAt)}
                      <span className="block text-muted">{time(slot.endsAt)}</span>
                    </th>
                    {halls.map((hall) => (
                      <td key={hall.id}>
                        <Cell session={at(i, hall.id)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="schedule-stack flex flex-col gap-12">
            {halls.map((hall) => (
              <section key={hall.id} aria-labelledby={`hall-${hall.id}`}>
                <h2 id={`hall-${hall.id}`} className="display text-step-2">
                  {hall.name}
                </h2>
                <ul className="mt-4">
                  {slots.map((slot, i) => (
                    <li key={slot.id} className="border-t border-border py-4">
                      <p className="mono text-step--1 text-muted">
                        {time(slot.startsAt)} to {time(slot.endsAt)}
                      </p>
                      <div className="mt-1">
                        <Cell session={at(i, hall.id)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </Container>
  )
}
