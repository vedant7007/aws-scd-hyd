import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PassCard, type PassSession } from '@/components/pass/PassCard'
import { PassPrinter } from '@/components/pass/PassPrinter'
import { PrefsForm } from '@/components/pass/PrefsForm'
import { doorsLabel, event, venue } from '@/content/event'
import { tierLabel } from '@/content/passes'
import { programSession } from '@/content/program'
import { TRANSPORT_PDF } from '@/content/transport'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { REPLY_TO } from '@/lib/email/templates'
import { absolute } from '@/lib/site'

/** A pass is private. It must never be indexed or appear in the sitemap. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/** Lookups hit the table on every request, never a cached render. */
export const dynamic = 'force-dynamic'

/** "30TH" from the one date in content/event.ts. */
const DAY_ORDINAL = (() => {
  const d = new Date(event.startsAt).getDate()
  const suffix = d % 10 === 1 && d !== 11 ? 'ST' : d % 10 === 2 && d !== 12 ? 'ND' : d % 10 === 3 && d !== 13 ? 'RD' : 'TH'
  return `${d}${suffix}`
})()

/** "21 DAYS TO GO", read on each request: the page is never cached. */
function countdownLabel(): string {
  const days = Math.ceil((Date.parse(event.startsAt) - Date.now()) / 86_400_000)
  return days > 1 ? `${days} DAYS TO GO` : days === 1 ? 'TOMORROW' : days === 0 ? 'TODAY' : 'SEE YOU NEXT TIME'
}

/**
 * The ticket, email 2's link. Only a VERIFIED pass renders: every other
 * state, and an id that does not exist, gets the same not-found page, so the
 * page cannot be used to learn anything about a record that is not a ticket.
 * Sessions were chosen at registration, so a verified pass is complete.
 */
export default async function PassPage({ params }: PageProps<'/pass/[passId]'>) {
  const { passId: raw } = await params
  const canonical = normalisePassId(raw)
  if (!canonical) notFound()
  // One URL per pass. A lowercase or unhyphenated link lands on the real one.
  if (canonical !== raw) redirect(`/pass/${canonical}`)

  // By key, strongly consistent: a student opening the link the second after a verify sees VERIFIED, not the index catching up.
  const attendee = await getAttendee(canonical)
  if (!attendee || attendee.state !== 'VERIFIED') notFound()

  const sessions: PassSession[] = [
    { label: 'Technical', title: programSession(attendee.technicalSession)?.title ?? attendee.technicalSession },
    ...(attendee.workshop ? [{ label: 'Workshop', title: programSession(attendee.workshop)?.title ?? attendee.workshop }] : []),
  ]

  const countdown = countdownLabel()
  // Google Calendar, prefilled: the doors time as the start, the venue as the place.
  const startUtc = new Date(event.startsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const calendar = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${startUtc}/${startUtc}&location=${encodeURIComponent(venue.name)}&details=${encodeURIComponent(`Your ticket: ${absolute(`/pass/${attendee.passId}`)}`)}`

  return (
    <div className="page rise">
      <div className="flex flex-col gap-2.5">
        <span className="pt-count">
          <span className="pt-count-dot" aria-hidden="true" />
          {countdown} · {doorsLabel} DOORS
        </span>
        <span className="eye">{'// THIS LINK IS YOUR TICKET'}</span>
        <h1 className="h1">
          SEE YOU ON THE {DAY_ORDINAL}, {attendee.name.toUpperCase()}
        </h1>
        <p className="lede">Print it below, then keep this page, a screenshot or the ticket email. It works with no signal at the gate, and you do not need to log in anywhere.</p>
      </div>

      <PassPrinter passId={attendee.passId} shareText={`I'm going to ${event.name}!`}>
        <PassCard
          passId={attendee.passId}
          name={attendee.name}
          college={attendee.college}
          tier={attendee.tier}
          tierName={tierLabel(attendee.tier)}
          sessions={sessions}
        />
      </PassPrinter>

      <PrefsForm passId={attendee.passId} food={attendee.food ?? null} busRoute={attendee.busRoute ?? null} busStop={attendee.busStop ?? null} />

      <nav aria-label="Ticket actions" className="pt-actions">
        <a href={calendar} target="_blank" rel="noopener" className="pt-action">
          <span className="pt-action-i" aria-hidden="true">▦</span>
          ADD TO CALENDAR
        </a>
        <a href={venue.directionsUrl} target="_blank" rel="noopener" className="pt-action">
          <span className="pt-action-i" aria-hidden="true">◉</span>
          DIRECTIONS
        </a>
        <a href={TRANSPORT_PDF} target="_blank" rel="noopener" className="pt-action">
          <span className="pt-action-i" aria-hidden="true">▣</span>
          BUS TIMINGS (PDF)
        </a>
        <Link href="/attending" className="pt-action" data-hot="1">
          <span className="pt-action-i" aria-hidden="true">★</span>
          I&apos;M ATTENDING POST
        </Link>
        <Link href={`/pass/${attendee.passId}/share`} className="pt-action">
          <span className="pt-action-i" aria-hidden="true">↗</span>
          TELL PEOPLE
        </Link>
      </nav>

      <section className="pt-day" aria-labelledby="pt-day-h">
        <span id="pt-day-h" className="pt-day-t">ON THE DAY</span>
        <ul>
          <li>
            <span aria-hidden="true">01</span>Doors open at {doorsLabel}. Come early, the gate queue is the slow part.
          </li>
          <li>
            <span aria-hidden="true">02</span>Turn your screen brightness up before you reach the volunteer. Sunlight kills scanner reads.
          </li>
          <li>
            <span aria-hidden="true">03</span>A volunteer scans your QR, writes your name on your ID card and hands over your lunch token. Your swag kit comes after you check in.
          </li>
          <li>
            <span aria-hidden="true">04</span>Lost this link? It is in your ticket email. Sessions may change; if yours does, we will email you.
          </li>
        </ul>
        <p className="hint">
          Need a change? Write to {REPLY_TO} with your pass ID. <Link href="/code-of-conduct#report">Something wrong? Report it.</Link>
        </p>
      </section>
    </div>
  )
}
