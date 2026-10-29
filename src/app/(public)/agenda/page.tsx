import type { Metadata } from 'next'
import { event, venue } from '@/content/event'
import { SCHEDULE_CAVEAT } from '@/content/schedule'
import { LiveSchedule } from '@/components/schedule/LiveSchedule'

export const metadata: Metadata = {
  title: 'Schedule',
  description: `The running order for ${event.name}, ${event.dateLabel} at ${venue.name}.`,
}

export default function SchedulePage() {
  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{`// ${event.dateLabel.toUpperCase()} · VJIT`}</span>
        <h1 className="h1 h1-lg">THE DAY, HOUR BY HOUR</h1>
        <p className="lede">
          Keynotes, tech talks, hands-on workshops, a panel and a project expo, from the gate at 8:30 am to the closing note on the lawn.
        </p>
        <p className="sc-caveat">{SCHEDULE_CAVEAT}</p>
      </div>
      <LiveSchedule />
      <a href={venue.directionsUrl} target="_blank" rel="noopener" className="btn btn-primary btn-lg self-start">
        DIRECTIONS TO VJIT
      </a>
    </div>
  )
}
