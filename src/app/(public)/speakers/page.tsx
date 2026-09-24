import type { Metadata } from 'next'
import Link from 'next/link'
import { event } from '@/content/event'
import { formats } from '@/content/formats'
import { speakers } from '@/content/speakers'

export const metadata: Metadata = {
  title: `Speakers, ${event.shortName}`,
  description: `Who is speaking at ${event.name}.`,
}

/**
 * Reads correctly with zero speakers, with one, and with many. The empty
 * state is the landing page's line-up section in page form: one reserved
 * slot per session format and the call for speakers. No placeholder names,
 * per SPEC.md section 11.
 */
export default function SpeakersPage() {
  const empty = speakers.length === 0
  return (
    <div className="page page-1180 rise">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-3">
          <span className="eye">{'// THE LINE-UP'}</span>
          <h1 className="h1">{empty ? 'NOT ANNOUNCED YET' : 'SPEAKERS'}</h1>
          <p className="lede">
            {empty
              ? 'Names go up one at a time, as each is signed, rather than holding the whole line-up back for one announcement. Check in now and then.'
              : 'Students and working engineers, across the keynote, the technical sessions and the panel. More names are added as they are signed.'}
          </p>
        </div>
        {empty ? <span className="pill pill-orange">First names drop soon</span> : null}
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {empty
          ? formats.map((f) => (
              <div key={f.id} className="slot-card">
                <div className="slot-art" aria-hidden="true">
                  <div className="bust" />
                  <span className="tag">???</span>
                </div>
                <span className="lbl">Session {f.no}</span>
                <span className="h3">{f.name}</span>
                <span className="lbl">Speaker soon</span>
              </div>
            ))
          : speakers.map((s) => (
              <div key={s.name} className="card flex flex-col gap-3 p-4">
                {s.format ? (
                  <span className="pill pill-ghost">{formats.find((f) => f.id === s.format)?.name ?? ''}</span>
                ) : null}
                <span className="h3">{s.name}</span>
                <span className="copy">
                  {s.role}, {s.org}
                </span>
              </div>
            ))}
        <div className="card-mint flex flex-col justify-center gap-3 p-4">
          <span className="h3">WANT TO SPEAK?</span>
          <p className="copy">Call for speakers is open: students and working engineers both.</p>
          <Link href="/speak" className="btn btn-mint">
            APPLY TO SPEAK
          </Link>
        </div>
      </div>
    </div>
  )
}
