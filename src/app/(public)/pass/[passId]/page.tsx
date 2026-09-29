import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PassCard, type PassSession } from '@/components/pass/PassCard'
import { doorsLabel, event, venue } from '@/content/event'
import { tierLabel } from '@/content/passes'
import { programSession } from '@/content/program'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { REPLY_TO } from '@/lib/email/templates'

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

  return (
    <div className="page rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// THIS LINK IS YOUR TICKET'}</span>
        <h1 className="h1">
          SEE YOU ON THE {DAY_ORDINAL}, {attendee.name.toUpperCase()}
        </h1>
        <p className="lede">Screenshot this page. It works with no signal at the gate, and you do not need to log in anywhere.</p>
      </div>

      <PassCard
        passId={attendee.passId}
        name={attendee.name}
        college={attendee.college}
        tier={attendee.tier}
        tierName={tierLabel(attendee.tier)}
        sessions={sessions}
      />

      <div className="flex flex-wrap gap-2.5">
        <a href={venue.directionsUrl} className="btn flex-[1_1_150px]">
          GATE PIN
        </a>
        <Link href={`/pass/${attendee.passId}/share`} className="btn flex-[1_1_150px]">
          TELL PEOPLE
        </Link>
      </div>

      <div className="card-dash flex flex-col gap-2.5 px-4 py-4">
        <span className="lbl eye-amber">On the day</span>
        <p className="copy">Doors at {doorsLabel}. The pin above is the gate.</p>
        <p className="copy">Turn your screen brightness up before you reach the volunteer. Sunlight kills scanner reads.</p>
        <p className="copy">Lost this link? It is in your confirmation email.</p>
        <p className="copy">Sessions are subject to change; if yours does, we will email you. If you need a change, write to {REPLY_TO} quoting your pass ID.</p>
        <Link href="/code-of-conduct#report" className="btn btn-mono self-start">
          Something wrong with your pass? Report it
        </Link>
      </div>
    </div>
  )
}
