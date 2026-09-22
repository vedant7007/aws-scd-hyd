import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm, type TierOption, type TrackOption } from '@/components/register/RegisterForm'
import { event, venue } from '@/content/event'
import { ALWAYS_INCLUDED, formatInr, passes, tierIds } from '@/content/passes'
import { tracks } from '@/content/tracks'
import type { Tier } from '@/lib/db/types'
import { registrationIsOpen } from '@/lib/tickets/launch'
import { placeholderPaise } from '@/lib/tickets/pricing'

export const metadata: Metadata = {
  title: `Register, ${event.shortName}`,
  description: `Get your pass for ${event.name}, ${event.dateLabel}.`,
}

/**
 * Our form, our rules. SPEC.md section 8, reshaped for a gateway: the site
 * owns registration, Razorpay only takes the money. Everything typed here is
 * validated again on the server and the amount is never sent from here.
 */
export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  if (!registrationIsOpen()) {
    return (
      <div className="page rise">
        <div className="flex flex-col gap-3">
          <span className="eye">{'// REGISTER'}</span>
          <h1 className="h1">OPENS SOON</h1>
          <p className="lede">Registration is not open yet. This page will say so the moment it is.</p>
        </div>
        <Link href="/" className="btn self-start">
          BACK HOME
        </Link>
      </div>
    )
  }

  // ?tier= preselects, from the pass grid. Anything unknown is ignored.
  const { tier } = await searchParams
  const preselect = typeof tier === 'string' && tierIds.includes(tier as Tier) ? (tier as Tier) : undefined

  // Prices come from content/passes.ts, the same place the checkout reads. A
  // tier without a price is offered at the test amount and says so on the form.
  const tiers: TierOption[] = passes.map((p) => ({
    id: p.id,
    name: p.name,
    priceLabel: formatInr(p.pricePaise ?? placeholderPaise()),
    placeholder: p.pricePaise === null,
    includes: [...p.includes, ...ALWAYS_INCLUDED],
    recommended: Boolean(p.recommended),
    tracksAllowed: p.tracksAllowed,
  }))
  const trackOptions: TrackOption[] = tracks.map((t) => ({ id: t.id, name: t.name, blurb: t.blurb }))

  return (
    <div className="page page-bar rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// REGISTER'}</span>
        <h1 className="h1">GET YOUR PASS</h1>
        <p className="lede">
          {event.dateLabel}, {venue.name}. One pass, one seat per session, lunch included. You pay on the next screen and your
          pass arrives by email.
        </p>
      </div>
      <RegisterForm tiers={tiers} tracks={trackOptions} preselect={preselect} eventName={event.shortName} contactEmail={event.contactEmail} />
    </div>
  )
}
