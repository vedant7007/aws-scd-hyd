import type { Metadata } from 'next'
import Link from 'next/link'
import { event } from '@/content/event'
import { SPONSORSHIP_SUBJECT, sponsorshipMailto } from '@/content/sponsors'

export const metadata: Metadata = {
  title: `Sponsor, ${event.shortName}`,
  description: `How to sponsor ${event.name}.`,
}

const GETS = [
  'Your logo on the site',
  'Your logo on the event posters',
  'A shout-out at the start of every session',
  'A shout-out in the mail that goes to every attendee',
  'Possibility of a stall inside the college premises, subject to campus approval',
  'Something of yours in every swag kit, tier 1 to tier 4',
]

const HINTS = ['Funds', 'Food or drinks', 'Goodies for kits', 'Prizes', 'Equipment', 'Internships or interviews', 'Cloud credits', 'Travel for speakers']

/**
 * The handoff's Sponsor screen with its form replaced by a mail, like the
 * Speak page. What a sponsor gets, what they can put in, and the one button.
 */
export default function SponsorPage() {
  return (
    <div className="page page-720 rise">
      <Link href="/speak" className="btn btn-mono self-start">
        Want to speak instead? &rarr;
      </Link>

      <div className="flex flex-col gap-3">
        <span className="eye">{'// BACK THE DAY'}</span>
        <h1 className="h1">SPONSOR US</h1>
        <p className="lede">
          A building full of engineering students for a whole day. Tell us what you want out of it and we will build the package around
          that.
        </p>
      </div>

      <div className="card-gold flex flex-col gap-3 p-5">
        <span className="lbl eye-amber">What you get</span>
        <ul className="checklist grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))]">
          {GETS.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="hint">Exact package depends on what you put in. Tell us and we will come back with a proper breakdown, not a PDF of tiers.</p>
      </div>

      <div className="card flex flex-col gap-5 p-5">
        <div className="card-dash flex flex-col gap-2.5 p-4">
          <span className="lbl eye-violet">What can you put in?</span>
          <p className="copy">Be specific and be honest, this is the part we actually plan around. Money is only one way to help.</p>
          <div className="flex flex-wrap gap-2">
            {HINTS.map((h) => (
              <span key={h} className="pill pill-ghost">
                {h}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="lbl">Put this in your mail</span>
          <ul className="checklist">
            <li>Your company or organisation, and a website or LinkedIn page</li>
            <li>The contact person, their role, an email and a phone number</li>
            <li>What you are sponsoring: food, event, swag kits, a stall, or something else</li>
            <li>What you can put in, and what you want out of the day</li>
          </ul>
        </div>

        <a href={sponsorshipMailto} className="btn btn-primary btn-lg">
          SEND ENQUIRY &gt;
        </a>
        <p className="hint">
          Opens a mail to {event.contactEmail} with the subject &ldquo;{SPONSORSHIP_SUBJECT}&rdquo;. One free pass to the day comes with any
          sponsorship. We reply within two working days, usually the same day, and nothing is committed until you say yes in writing.
        </p>
      </div>
    </div>
  )
}
