import { requireAdmin } from '@/lib/auth/admin'
import { getTraffic, listSubscribers, type HitRow } from '@/lib/db/queries'
import { OTHER, lastDays } from '@/lib/traffic'

/**
 * Who is looking at the site, from the site's own counter (/api/hit). Admin
 * only: volunteers have no reason to see it, and it sits behind the same
 * guard as the notify list.
 *
 * A view is one page shown. A visit is one browser tab's session on the
 * site, counted by the browser, so the same person on two devices is two
 * visits. No cookies and no addresses are involved in either number.
 */

const WINDOW = 14

const PAGE_NAME: Record<string, string> = {
  '/': 'Home',
  '/register': 'Register (notify me)',
  '/speak': 'Speak at SCD',
  '/sponsor': 'Sponsor us',
  '/code-of-conduct': 'Code of conduct',
  [OTHER]: 'Anything else, and 404s',
}

type Count = { views: number; visits: number }

const n = (v: number | undefined) => v ?? 0

function fold(rows: HitRow[], prefix: string, into: Map<string, Count>) {
  for (const r of rows) {
    if (!r.SK.startsWith(prefix)) continue
    const key = r.SK.slice(prefix.length)
    const c = into.get(key) ?? { views: 0, visits: 0 }
    c.views += n(r.views)
    c.visits += n(r.visits)
    into.set(key, c)
  }
}

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))

export default async function TrafficPage() {
  await requireAdmin()

  const days = lastDays(WINDOW)
  const [byDay, subs] = await Promise.all([getTraffic(days), listSubscribers()])

  const daily = days.map((d) => {
    const t = byDay[d]!.find((r) => r.SK === 'TOTAL')
    return { day: d, views: n(t?.views), visits: n(t?.visits) }
  })
  const pages = new Map<string, Count>()
  const refs = new Map<string, Count>()
  for (const d of days) {
    fold(byDay[d]!, 'PATH#', pages)
    fold(byDay[d]!, 'REF#', refs)
  }

  const views = daily.reduce((a, d) => a + d.views, 0)
  const visits = daily.reduce((a, d) => a + d.visits, 0)
  const today = daily.at(-1)!
  const busiest = Math.max(0, ...daily.map((d) => d.views))
  // Bar heights divide by this, so it can never be zero.
  const peak = Math.max(1, busiest)

  const topPages = [...pages].sort((a, b) => b[1].views - a[1].views)
  const topRefs = [...refs].sort((a, b) => b[1].visits - a[1].visits).slice(0, 10)
  const direct = Math.max(0, visits - [...refs.values()].reduce((a, c) => a + c.visits, 0))

  // The one number that matters while registration is closed: of the people
  // who reached the register page, how many left an address.
  const since = days[0]!
  const signups = subs.filter((s) => s.createdAt && s.createdAt.slice(0, 10) >= since).length
  const regVisits = pages.get('/register')?.visits ?? 0
  const regViews = pages.get('/register')?.views ?? 0
  const rate = regVisits ? Math.round((signups / regVisits) * 100) : null

  const firstCounted = daily.find((d) => d.views > 0)?.day

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// TRAFFIC'}</span>
        <h1 className="h1">WHO IS LOOKING</h1>
        <p className="lede">
          The last {WINDOW} days, in Hyderabad time, from the site&rsquo;s own counter. A view is one page shown; a visit is one browser tab&rsquo;s
          time on the site. No cookies, no IP addresses. Crew pages are not counted.
        </p>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        <Stat label="Views" value={views} note={`last ${WINDOW} days`} />
        <Stat label="Visits" value={visits} note={`last ${WINDOW} days`} />
        <Stat label="Today" value={today.views} note={`${today.visits} visits`} />
        <Stat label="Notify signups" value={subs.length} note={`${signups} in the last ${WINDOW} days`} tone="ok" />
      </div>

      <section className="card flex flex-col" aria-labelledby="daily-h">
        <div className="card-head">
          <span id="daily-h" className="card-title">
            VIEWS PER DAY
          </span>
          <span className="lbl">busiest day {busiest}</span>
        </div>
        <ol className="tr-bars" aria-label={`Views per day for the last ${WINDOW} days`}>
          {daily.map((d) => (
            <li key={d.day} className="tr-bar" aria-label={`${fmtDay(d.day)}: ${d.views} views, ${d.visits} visits`}>
              <span className="tr-val num" aria-hidden="true">
                {d.views || ''}
              </span>
              <span className="tr-col" style={{ height: `${Math.round((d.views / peak) * 100)}%` }} aria-hidden="true" />
              <span className="tr-day num" aria-hidden="true">
                {fmtDay(d.day)}
              </span>
            </li>
          ))}
        </ol>
        {firstCounted ? null : (
          <p className="row-body">Nothing counted yet. Numbers start with the first page view after this counter went live.</p>
        )}
      </section>

      <section className="card flex flex-col" aria-labelledby="funnel-h">
        <div className="card-head">
          <span id="funnel-h" className="card-title">
            THE REGISTER PAGE
          </span>
          <span className="lbl">last {WINDOW} days</span>
        </div>
        <div className="row">
          <span className="copy">Visits that reached it</span>
          <span className="stat-val stat-val-sm num">{regVisits}</span>
        </div>
        <div className="row">
          <span className="copy">Times it was shown</span>
          <span className="stat-val stat-val-sm num">{regViews}</span>
        </div>
        <div className="row">
          <span className="copy">Addresses left</span>
          <span className="stat-val stat-val-sm num">{signups}</span>
        </div>
        <div className="row">
          <span className="copy">Left an address, per visit</span>
          <span className="stat-val stat-val-sm num" data-tone="ok">
            {rate === null ? '-' : `${rate}%`}
          </span>
        </div>
        <p className="row-body">
          Signups here are counted by date and visits by the counter, which only started when it went live. Until it has run for the full
          window, signups from before it can make the rate read high.
        </p>
      </section>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <section className="card flex flex-col" aria-labelledby="pages-h">
          <div className="card-head">
            <span id="pages-h" className="card-title">
              PAGES
            </span>
            <span className="lbl">views · visits</span>
          </div>
          {topPages.length ? (
            topPages.map(([p, c]) => (
              <div key={p} className="row">
                <span className="flex flex-col">
                  <span className="copy">{PAGE_NAME[p] ?? p}</span>
                  <span className="hint num">{p}</span>
                </span>
                <span className="num text-ink">
                  {c.views} · {c.visits}
                </span>
              </div>
            ))
          ) : (
            <p className="row-body">No page views yet.</p>
          )}
        </section>

        <section className="card flex flex-col" aria-labelledby="refs-h">
          <div className="card-head">
            <span id="refs-h" className="card-title">
              WHERE VISITS CAME FROM
            </span>
            <span className="lbl">visits</span>
          </div>
          {topRefs.map(([host, c]) => (
            <div key={host} className="row">
              <span className="copy num">{host}</span>
              <span className="num text-ink">{c.visits}</span>
            </div>
          ))}
          <div className="row">
            <span className="copy">Typed in, bookmarked, or the app hid the source</span>
            <span className="num text-ink">{direct}</span>
          </div>
          <p className="row-body">
            Top ten sites by visits. Instagram and WhatsApp links usually arrive with no source, so a shared link mostly lands in the last
            row.
          </p>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: 'ok' }) {
  return (
    <div className="stat-card">
      <span className="lbl">{label}</span>
      <span className="stat-val num" data-tone={tone}>
        {value}
      </span>
      {note ? <span className="hint">{note}</span> : null}
    </div>
  )
}
