import type { Metadata } from 'next'
import { event, venue } from '@/content/event'

export const metadata: Metadata = {
  title: `Code of conduct, ${event.shortName}`,
  description: `The code of conduct for ${event.name}.`,
}

const REPORT_MAILTO = `mailto:${event.contactEmail}?subject=${encodeURIComponent('Code of conduct report')}`

const EXPECT = [
  ['BE DECENT', 'Nobody here is behind. People are at wildly different levels and every one of them paid to be in the room.'],
  ['ASK, THEN SHOOT', 'Ask before you photograph or record someone, and stop if they say no. This includes group shots and stories.'],
  ['RESPECT THE HALL', 'Take calls outside, keep phones silent in sessions, and let the speaker finish before the Q and A.'],
  ['LISTEN TO VOLUNTEERS', 'They are students giving up their day. If a volunteer asks you to move or wait, do it.'],
] as const

const NOT_OK = [
  "Harassment of any kind, including comments about someone's gender, caste, religion, region, language, appearance, disability or sexuality.",
  'Unwanted attention, following someone around, or repeated messaging after being asked to stop.',
  'Photographing or recording someone who has said no, or sharing it afterwards.',
  'Mocking someone for asking a basic question, or for their English.',
  'Sharing or reselling your pass, or trying to enter a hall you do not have a seat in.',
  'Alcohol, drugs, weapons, or damaging campus property.',
  'Recruiting or hard-selling to attendees if you are not a sponsor with a stall.',
]

/**
 * The handoff's Code of Conduct screen. Its issue form generated tickets in
 * the browser with no backend behind them, so the #report section here is
 * a mail instead: same anchor, same place, and a report reaches a person.
 *
 * TODO(vedant): this copy is the design handoff's draft and is still on the
 * blocked list in SPEC.md section 15 for sign-off, the named contact
 * included. Replace the text here, nowhere else.
 */
export default function CodeOfConductPage() {
  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// REQUIRED FOR EVERY AWS COMMUNITY EVENT'}</span>
        <h1 className="h1 h1-lg">CODE OF CONDUCT</h1>
        <p className="lede">
          This applies to everyone at {event.name}: attendees, speakers, sponsors, volunteers and organisers, for the whole day, in every
          hall, and in any chat or group connected to the event.
        </p>
        <p className="lede">Short version: treat people the way you would want your own juniors treated. If you are not sure whether something is fine, it probably is not.</p>
      </div>

      <section className="flex flex-col gap-3.5" aria-labelledby="expect-h">
        <h2 id="expect-h" className="h2">
          WHAT WE EXPECT
        </h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {EXPECT.map(([title, body]) => (
            <div key={title} className="card flex flex-col gap-2 p-4">
              <span className="h3">{title}</span>
              <p className="copy">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3.5" aria-labelledby="not-h">
        <h2 id="not-h" className="h2">
          NOT ACCEPTABLE
        </h2>
        <ul className="checklist crosslist card-err p-5">
          {NOT_OK.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3.5" aria-labelledby="break-h">
        <h2 id="break-h" className="h2">
          WHAT HAPPENS IF YOU BREAK IT
        </h2>
        <div className="card">
          <div className="numlist">
            <span className="n">01</span>
            <span>A volunteer or organiser asks you to stop. That is your one warning.</span>
          </div>
          <div className="numlist">
            <span className="n">02</span>
            <span>If it continues, your pass is cancelled and you are asked to leave campus. No refund.</span>
          </div>
          <div className="numlist">
            <span className="n" data-tone="err">
              03
            </span>
            <span>Serious cases go to {venue.name} campus security, your college, and the police where the law requires it.</span>
          </div>
        </div>
        <p className="hint">Organisers can skip straight to step 2 or 3. We do not owe anyone a warning before removing them.</p>
      </section>

      <section className="flex flex-col gap-3.5" aria-labelledby="tell-h">
        <h2 id="tell-h" className="h2">
          WHO TO TELL
        </h2>
        <div className="card-gold flex flex-col gap-3.5 p-5">
          <span className="lbl eye-amber">Named reporting contact</span>
          <div className="flex flex-col gap-1">
            <span className="h1">RUTHVIK</span>
            <span className="copy">AWS Student Builders Group, VJIT chapter</span>
          </div>
          <p className="copy">
            On the day, find Ruthvik or any volunteer in an organiser lanyard, and they will bring him to you. You do not have to explain
            yourself to a stranger first.
          </p>
          <a href={REPORT_MAILTO} className="btn btn-ink self-start">
            MAIL US NOW
          </a>
          <span className="num text-[11px] text-muted">{event.contactEmail}</span>
        </div>
        <p className="hint">We will not tell the other person who reported them unless you say we can. If you would rather not speak to anyone, write instead.</p>
      </section>

      <section id="report" className="panel scroll-mt flex flex-col gap-4 p-5" aria-labelledby="report-h">
        <div className="flex flex-col gap-2">
          <span className="eye eye-violet">{'// REPORT AN ISSUE'}</span>
          <h2 id="report-h" className="h2">
            TELL US IN WRITING
          </h2>
          <p className="copy">Use this for conduct reports, registration problems, payment issues or anything else. Only the organising team reads it.</p>
        </div>
        <ul className="checklist">
          <li>What it is about: conduct, registration, payment, or something else</li>
          <li>Your pass ID, if you have one</li>
          <li>Where, when, who was involved, and what you want us to do about it</li>
          <li>Leave your name out if you would rather we did not know it</li>
        </ul>
        <p className="copy text-err-ink">If you are in danger right now, do not wait for email. Find any volunteer, or call campus security.</p>
        <a href={REPORT_MAILTO} className="btn btn-primary btn-lg self-start">
          SEND A REPORT &gt;
        </a>
        <p className="hint">We reply from {event.contactEmail}, usually within two days, faster for anything about payments or the event day itself.</p>
      </section>

      <p className="legal border-t-[3px] border-line-soft pt-5">
        Adapted for {event.name}, hosted by the AWS Student Builders Group at {venue.name}. {event.disclaimer}
      </p>
    </div>
  )
}
