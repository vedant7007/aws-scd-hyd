import type { Metadata } from 'next'
import { listAttendees } from '@/lib/db/queries'
import { normalisePassId } from '@/lib/db/keys'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hands-on venues',
  description: 'Which venue you take the two hands-on sessions in.',
}

/**
 * The hands-on split, for a QR at the hall doors. A group pass stays in one
 * lab: people are taken as units (a group, or one person), in name order, and
 * C 205 fills to half before N 203 takes the rest. Both labs take both sessions.
 * The lists show names only. A pass id is matched on the server and never
 * printed, so the page does not hand out everyone's pass.
 */
export default async function HandsOnPage({ searchParams }: PageProps<'/handson'>) {
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim()

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  const units = new Map<string, { name: string; passId: string }[]>()
  for (const a of await listAttendees()) {
    // Basic passes do not include the hands-on workshop (content/passes.ts).
    if (a.state !== 'VERIFIED' || a.source === 'preview' || a.tier === 'basic') continue
    const key = a.groupId ?? a.passId
    units.set(key, [...(units.get(key) ?? []), { name: a.name.trim(), passId: a.passId }])
  }
  const ordered = [...units.values()].map((u) => u.sort(byName)).sort((a, b) => byName(a[0], b[0]))
  const total = ordered.reduce((n, u) => n + u.length, 0)
  const labs = { 'C 205 LAB': [] as { name: string; passId: string }[], 'N 203 LAB': [] as { name: string; passId: string }[] }
  for (const u of ordered) (labs['C 205 LAB'].length < total / 2 ? labs['C 205 LAB'] : labs['N 203 LAB']).push(...u)
  const people = Object.entries(labs).flatMap(([venue, ps]) => ps.sort(byName).map((p) => ({ ...p, venue })))
  const venues = Object.entries(labs).map(([label, ps]) => ({ label, names: ps.map((p) => p.name) }))

  const passId = normalisePassId(q)
  const needle = q.toLowerCase()
  const matches = !q
    ? []
    : people
        .map((p) => ({ name: p.name, venue: p.venue, hit: passId ? p.passId === passId : needle.length >= 2 && p.name.toLowerCase().includes(needle) }))
        .filter((m) => m.hit)
        .slice(0, 10)

  return (
    <div className="page page-760 rise flex flex-col gap-7">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// HANDS-ON SESSIONS · PREMIUM, VIP & ULTRA'}</span>
        <h1 className="h1 h1-lg">FIND YOUR LAB</h1>
        <p className="lede">You take both hands-on sessions in the same lab. Search your name or pass ID to see which one.</p>
      </div>

      <form method="get" className="card-orange flex flex-col gap-3 p-4">
        <label htmlFor="hq" className="lbl">
          Your name or pass ID
        </label>
        <div className="flex gap-2">
          <input id="hq" name="q" defaultValue={q} placeholder="e.g. Priya or SCD-XXXXXXXXXX" autoComplete="off" className="inp min-w-0 flex-1" />
          <button type="submit" className="btn btn-primary">
            FIND
          </button>
        </div>
      </form>

      {q && (
        <div aria-live="polite" className="flex flex-col gap-3">
          {matches.length === 0 ? (
            <div className="card-warn p-4">
              <p className="lede">
                No match for &quot;{q}&quot;. Try part of your name. Hands-on is for Premium, VIP and Ultra passes; ask a volunteer if yours is one.
              </p>
            </div>
          ) : (
            matches.map((m, i) => (
              <div key={i} className="card-gold flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="card-title">{m.name}</span>
                <span className="h2">{m.venue}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {venues.map((v) => (
          <a key={v.label} href={`#${v.label.replaceAll(' ', '-')}`} className="card flex flex-col gap-1 p-4">
            <span className="h2">{v.label}</span>
            <span className="lbl">
              <span className="num">{v.names.length}</span> people
            </span>
          </a>
        ))}
      </div>

      {venues.map((v) => (
        <section key={v.label} id={v.label.replaceAll(' ', '-')} className="card scroll-mt-24">
          <div className="card-head">
            <span className="card-title">{v.label}</span>
            <span className="lbl">A to Z · groups together</span>
          </div>
          <ol className="grid gap-x-6 p-4 sm:grid-cols-2">
            {v.names.map((n, i) => (
              <li key={i} className="flex gap-3 border-b border-[var(--line-soft)] py-2">
                <span className="num w-7 shrink-0 text-right text-[var(--muted)]">{i + 1}</span>
                <span>{n}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
