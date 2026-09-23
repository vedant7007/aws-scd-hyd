import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { event } from '@/content/event'
import { sponsorTiers, sponsors } from '@/content/sponsors'

export const metadata: Metadata = {
  title: `Sponsors, ${event.shortName}`,
  description: `Sponsors of ${event.name}, and how to become one.`,
}

/**
 * The landing page's sponsor section in page form: the title sponsor,
 * then the community partners with the open slots beside them and the
 * call to back the day. Empty for weeks, so it is built as a pitch rather
 * than a gap.
 */
export default function SponsorsPage() {
  const byTier = sponsorTiers.map((tier) => ({ tier, list: sponsors.filter((s) => s.tierId === tier.id) }))

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// WHO IS BEHIND IT'}</span>
        <h1 className="h1">SPONSORS</h1>
        <p className="lede">This day exists because AWS funds community events run by students. Everything else comes from the partners below.</p>
      </div>

      <section className="card-orange relative flex flex-col items-center gap-4 overflow-hidden p-6 text-center sh-soft" aria-labelledby="title-h">
        <span className="pill pill-orange">Title sponsor</span>
        <h2 id="title-h" className="h1 text-amber-ink">
          AMAZON WEB SERVICES
        </h2>
        <p className="lede text-center">The programme, the halls, the swag and the lunch are all paid for out of that support.</p>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-2">
          <span className="eye">{'// COMMUNITY SPONSORS'}</span>
          <h2 className="h2">WHO ELSE IS BEHIND IT</h2>
        </div>
        <span className="lbl">Food · event · swag</span>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {byTier.flatMap(({ tier, list }) =>
          list.map((s) => (
            <a key={s.name} href={s.url} rel="noreferrer noopener" target="_blank" className="card flex flex-col gap-3.5 p-5 text-ink lift">
              <span className="lbl text-mint-ink">{tier.name}</span>
              {s.logo ? (
                <span className="flex min-h-[200px] items-center justify-center border-2 border-line-soft bg-bg p-5">
                  <Image src={s.logo} alt={s.name} width={200} height={200} sizes="220px" className="block h-auto w-full max-w-[220px]" />
                </span>
              ) : null}
              <span className="big-word">{s.name}</span>
              {s.tagline ? <span className="copy">{s.tagline}</span> : null}
              <span className="lbl mt-auto text-mint-ink">View &rarr;</span>
            </a>
          )),
        )}
        {['FOOD SPONSOR', 'SWAG SPONSOR'].map((slot) => (
          <div key={slot} className="card-dash flex flex-col gap-3 p-5">
            <span className="lbl">Slot open</span>
            {/* Decorative placeholder mark. The slot's real label is below it, so this is hidden from assistive tech rather than recoloured away from the handoff. */}
            <span aria-hidden="true" className="flex min-h-[200px] items-center justify-center border-2 border-line-soft bg-panel font-display text-[56px] text-slot2">
              ?
            </span>
            <span className="h3">{slot}</span>
            <span className="copy">
              {slot === 'FOOD SPONSOR' ? 'Feed every student in the building and get your name on every table.' : 'Your thing in every swag kit, tier 1 to tier 4.'}
            </span>
          </div>
        ))}
        <div className="card-mint flex flex-col justify-center gap-3 p-5">
          <span className="h3">BACK THE DAY</span>
          <p className="copy">Food, event and swag sponsorships are all open. Tell us which one fits.</p>
          <Link href="/sponsor" className="btn btn-mint">
            BECOME A SPONSOR
          </Link>
        </div>
      </div>
    </div>
  )
}
