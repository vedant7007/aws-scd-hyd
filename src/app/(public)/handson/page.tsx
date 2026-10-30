import type { Metadata } from 'next'
import { listAttendees } from '@/lib/db/queries'
import { normalisePassId } from '@/lib/db/keys'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hands-on venues',
  description: 'Which venue you take the two hands-on sessions in.',
}

/**
 * The hands-on split, for a QR at the hall doors. Verified attendees sorted by
 * name, first half Venue 1, the rest Venue 2. Both halves take both sessions.
 * The lists show names only. A pass id is matched on the server and never
 * printed, so the page does not hand out everyone's pass.
 */
export default async function HandsOnPage({ searchParams }: PageProps<'/handson'>) {
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim()

  const people = (await listAttendees())
    .filter((a) => a.state === 'VERIFIED' && a.source !== 'preview')
    .map((a) => ({ name: a.name.trim(), passId: a.passId }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const half = Math.ceil(people.length / 2)
  const venueOf = (i: number) => (i < half ? 'VENUE 1' : 'VENUE 2')
  const venues = [
    { label: 'VENUE 1', names: people.slice(0, half).map((p) => p.name) },
    { label: 'VENUE 2', names: people.slice(half).map((p) => p.name) },
  ]

  const passId = normalisePassId(q)
  const needle = q.toLowerCase()
  const matches = !q
    ? []
    : people
        .map((p, i) => ({ name: p.name, venue: venueOf(i), hit: passId ? p.passId === passId : needle.length >= 2 && p.name.toLowerCase().includes(needle) }))
        .filter((m) => m.hit)
        .slice(0, 10)

  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// HANDS-ON SESSIONS'}</span>
        <h1 className="h1 h1-lg">FIND YOUR VENUE</h1>
        <p className="lede">Everyone takes both hands-on sessions. Search your name or pass ID, or find your name in the lists below.</p>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Your name or SCD-XXXXXXXXXX"
            aria-label="Your name or pass ID"
            className="min-w-0 flex-1 rounded border px-3 py-2"
          />
          <button type="submit" className="btn btn-primary">
            FIND
          </button>
        </form>
        {q && (
          <div className="flex flex-col gap-1" aria-live="polite">
            {matches.length === 0 ? (
              <p className="lede">No match for &quot;{q}&quot;. Try part of your name, or ask a volunteer.</p>
            ) : (
              matches.map((m, i) => (
                <p key={i} className="lede">
                  <strong>{m.name}</strong>: {m.venue}
                </p>
              ))
            )}
          </div>
        )}
        <p className="lede">
          {venues.map((v) => (
            <a key={v.label} href={`#${v.label.replace(' ', '-')}`} className="mr-4 underline">
              {v.label} ({v.names.length})
            </a>
          ))}
        </p>
      </div>
      {venues.map((v) => (
        <section key={v.label} id={v.label.replace(' ', '-')} className="mt-10 flex flex-col gap-3">
          <h2 className="h1">{v.label}</h2>
          <p className="lede">
            {v.names[0]} to {v.names[v.names.length - 1]}
          </p>
          <ol className="list-decimal pl-6 leading-8">
            {v.names.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
