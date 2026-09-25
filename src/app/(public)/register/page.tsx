import type { Metadata } from 'next'
import Link from 'next/link'
import { LockedHero } from '@/components/register/LockedHero'
import { NotifyForm, type PassChip } from '@/components/register/NotifyForm'
import { event, venue } from '@/content/event'
import { formatCount } from '@/content/formats'
import { formatInr, passes } from '@/content/passes'

export const metadata: Metadata = {
  title: `Registrations open soon, ${event.shortName}`,
  description: `Registrations for ${event.name} on ${event.dateLabel} have not opened yet. Leave your email and we will tell you the moment they do.`,
}

/**
 * The closed registration screen. Registration is off at the source
 * (REGISTRATION_OPEN in content/event.ts) and this is what the whole site's
 * REGISTER and NOTIFY ME controls point at: a locked padlock, an email field
 * and nothing to pay for. The flow that sells passes is parked, not deleted,
 * under /register-legacy.
 */

/** Chip colours are tokens, so the swatches follow the theme like everything else. */
const SWATCH: Record<string, string> = {
  basic: 'var(--fmt-keynote)',
  premium: 'var(--fmt-technical)',
  ultra: 'var(--fmt-panel)',
  vip: 'var(--gold)',
}

/** The ticker's date, "30.10.2026", off the one startsAt everything else reads. */
const tickerDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})
  .format(new Date(event.startsAt))
  .replace(/\//g, '.')

const TICKER = ['REGISTRATION · LOCKED', 'OPENING SOON', `${tickerDate} · VJIT ${event.city.toUpperCase()}`, 'GET NOTIFIED FIRST']

const NEXT = [
  ['PICK A PASS', `Four passes, from ${formatInr(49900)}. Every one includes lunch and a swag kit.`, '/#passes', 'SEE THE PASSES'],
  ['SEE THE DAY', `${formatCount} session formats, one Friday, ${venue.name}.`, '/schedule', 'SEE THE SCHEDULE'],
  ['MEET THE SPEAKERS', 'Engineers and builders from the cloud and AI world.', '/speakers', 'SEE THE SPEAKERS'],
] as const

/** Two copies side by side, so the -50% march loops without a gap. */
function TickerRun() {
  return (
    <span className="rg-marq-run">
      {TICKER.map((t) => (
        <span key={t} style={{ display: 'contents' }}>
          <span>{t}</span>
          <span className="rg-marq-d">◆</span>
        </span>
      ))}
    </span>
  )
}

export default function RegisterPage() {
  const chips: PassChip[] = passes.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.pricePaise === null ? 'TBA' : formatInr(p.pricePaise),
    swatch: SWATCH[p.id] ?? 'var(--bar)',
  }))

  return (
    <>
      <div className="rg-marq" aria-hidden="true">
        <div className="rg-marq-in">
          <TickerRun />
          <TickerRun />
        </div>
      </div>

      <div className="page page-1180 rise">
        <div className="rg-split">
          <LockedHero />

          <div className="rg-main">
            <div className="rg-status">
              <span className="rg-chip">
                <span className="rg-dot" aria-hidden="true" />
                STATUS: LOCKED
              </span>
              <span className="rg-soon">OPENING SOON</span>
            </div>

            <h1 className="rg-h1">
              REGISTRATIONS
              <br />
              <span>OPEN SOON</span>
            </h1>

            <p className="lede">
              We are still finalising the sessions and how registration will work. Leave your email and we will write to you the moment it
              opens, nothing else.
            </p>

            <NotifyForm chips={chips} />
          </div>
        </div>

        <section className="flex flex-col gap-3.5" aria-labelledby="next-h">
          <h2 id="next-h" className="h2">
            WHILE YOU WAIT
          </h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            {NEXT.map(([title, body, href, cta]) => (
              <div key={title} className="card flex flex-col gap-2 p-4">
                <span className="h3">{title}</span>
                <p className="copy">{body}</p>
                <Link href={href} className="btn btn-sm mt-auto self-start">
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="hint">
          Questions before registrations open? Write to <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a>.
        </p>
      </div>
    </>
  )
}
