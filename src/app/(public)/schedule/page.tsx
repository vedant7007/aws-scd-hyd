import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { doorsLabel, event, REGISTRATION_OPEN, venue } from '@/content/event'
import { formats } from '@/content/formats'

export const metadata: Metadata = {
  title: `Schedule, ${event.shortName}`,
  description: `The programme for ${event.name}, ${event.dateLabel}.`,
}

/**
 * The programme, one card per session format. The day is built from the five
 * formats in content/formats.ts, not from parallel tracks: there is no track
 * to pick, no hall to find and no per-slot timetable on this page. Exact
 * times are deliberately absent until the organiser confirms them, so nobody
 * plans a train around a placeholder.
 */
export default function SchedulePage() {
  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// THE PROGRAMME'}</span>
        <h1 className="h1">SCHEDULE</h1>
        <p className="lede">
          {event.dateLabel}, doors at {doorsLabel}, {venue.name}. Five kinds of session across one day. Titles, speakers and the running
          order go up here as they are confirmed.
        </p>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {formats.map((f) => (
          <section
            key={f.id}
            className="card flex flex-col gap-2.5 p-4"
            style={{ borderLeft: '6px solid var(--sf)', '--sf': f.accent } as CSSProperties}
            aria-labelledby={`fmt-${f.id}`}
          >
            <span className="lbl">Session {f.no}</span>
            <h2 id={`fmt-${f.id}`} className="h3">
              {f.name}
            </h2>
            <p className="copy">{f.blurb}</p>
            <div className="flex flex-wrap gap-2 mt-auto">
              {f.tags.map((t) => (
                <span key={t} className="pill pill-ghost">
                  {t}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card-dash flex flex-col gap-2 p-4">
        <span className="lbl eye-amber">Times</span>
        <p className="copy">
          The exact running order is still being set with the speakers. It goes up here once it is fixed, and everyone on the notify list
          hears about it.
        </p>
      </div>

      <div className="card-mint flex flex-col gap-3 p-4">
        <span className="h3">{REGISTRATION_OPEN ? 'REGISTER FOR THE DAY' : 'REGISTRATIONS OPEN SOON'}</span>
        <p className="copy">
          Which sessions you can attend depends on your pass. The keynote and a technical session are on every pass; workshops, the panel
          and the Q and A come with the higher tiers.
        </p>
        <Link href="/register" className="btn btn-primary self-start">
          {REGISTRATION_OPEN ? 'REGISTER' : 'NOTIFY ME'}
        </Link>
      </div>
    </div>
  )
}
