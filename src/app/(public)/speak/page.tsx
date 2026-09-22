import type { Metadata } from 'next'
import Link from 'next/link'
import { event } from '@/content/event'
import { SPEAKER_SUBJECT, speakerMailto } from '@/content/speakers'
import { tracks } from '@/content/tracks'

export const metadata: Metadata = {
  title: `Apply to speak, ${event.shortName}`,
  description: `The call for speakers at ${event.name}.`,
}

/**
 * The handoff's Speak screen with its form replaced by a mail: there is no
 * backend for applications and the inbox is where they are read. The page
 * says what to put in the mail, and the one button opens it with the fixed
 * subject the inbox filters on.
 */
export default function SpeakPage() {
  return (
    <div className="page page-720 rise">
      <Link href="/sponsor" className="btn btn-mono self-start">
        Want to sponsor instead? &rarr;
      </Link>

      <div className="flex flex-col gap-3">
        <span className="eye">{'// CALL FOR SPEAKERS'}</span>
        <h1 className="h1">APPLY TO SPEAK</h1>
        <p className="lede">
          Students and working engineers both. You do not need to be famous, you need something real to say and the willingness to take
          questions.
        </p>
      </div>

      <div className="card flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <span className="lbl">Which track?</span>
          <div className="flex flex-col gap-2.5">
            {tracks.map((t) => (
              <div key={t.id} className="card-soft flex flex-col gap-1.5 p-3.5">
                <span className="flex items-center gap-2.5">
                  <span className="dot dot-round" data-track={t.id} aria-hidden="true" />
                  <span className="opt-title">{t.name.toUpperCase()}</span>
                </span>
                <span className="opt-note">{t.blurb}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-dash flex flex-col gap-2.5 p-4">
          <span className="lbl eye-violet">Put this in your mail</span>
          <ul className="checklist">
            <li>Your name, and your role and company or college</li>
            <li>A phone number we can reach you on</li>
            <li>Which track, and a title for the talk</li>
            <li>Three or four lines on what you will cover, who it is for, and what they walk away able to do</li>
          </ul>
        </div>

        <a href={speakerMailto} className="btn btn-primary btn-lg">
          SEND APPLICATION &gt;
        </a>
        <p className="hint">
          Opens a mail to {event.contactEmail} with the subject &ldquo;{SPEAKER_SUBJECT}&rdquo;. Accepted speakers get one free pass to the day.
          We read every application and you will hear either way, a no from us is still a reply.
        </p>
      </div>
    </div>
  )
}
