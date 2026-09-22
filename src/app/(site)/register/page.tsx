import type { Metadata } from 'next'
import { Container } from '@/components/layout/Container'
import { RegisterForm, type TierOption } from '@/components/register/RegisterForm'
import { event, venue } from '@/content/event'
import { ALWAYS_INCLUDED, formatInr, passes, tierIds } from '@/content/passes'
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
      <Container className="section-loose">
        <p className="eyebrow">Register</p>
        <div className="awaiting mt-6">
          <p className="awaiting-head">
            Registration <em>opens soon</em>
          </p>
          <p className="measure text-muted">
            Passes and prices are announced closer to the date. The signup on the home page will tell you first.
          </p>
        </div>
      </Container>
    )
  }

  // ?tier= preselects, from the pass grid. Anything unknown is ignored.
  const { tier } = await searchParams
  const preselect = typeof tier === 'string' && tierIds.includes(tier as Tier) ? (tier as Tier) : undefined

  // TODO(vedant): PLACEHOLDER PRICING, see lib/tickets/pricing.ts. A tier
  // without a price is offered at the test amount and says so on the form.
  const tiers: TierOption[] = passes.map((p) => ({
    id: p.id,
    name: p.name,
    priceLabel: formatInr(p.pricePaise ?? placeholderPaise()),
    placeholder: p.pricePaise === null,
    includes: [...p.includes, ...ALWAYS_INCLUDED],
    recommended: Boolean(p.recommended),
  }))

  return (
    <Container className="section-tight">
      <header className="enter">
        <p className="eyebrow">Register</p>
        <h1 className="display text-step-3 mt-2">Get your pass</h1>
        <p className="measure mt-4 text-muted">
          {event.dateLabel}, {venue.name}. One pass, one seat per session, lunch included. You pay on the next
          screen and your pass arrives by email.
        </p>
      </header>

      <div className="reg-grid mt-12">
        <RegisterForm tiers={tiers} preselect={preselect} eventName={event.shortName} contactEmail={event.contactEmail} />
      </div>
    </Container>
  )
}
