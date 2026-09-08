import { Section } from '@/components/layout/Section'
import { ALWAYS_INCLUDED, earlyBirdEndsAt, passes } from '@/content/passes'

export function Passes() {
  if (passes.length === 0) {
    return (
      <Section id="passes" title="Passes">
        <p className="measure text-step-1 text-muted">
          Pass tiers and prices are announced soon. Lunch is included on every tier.
        </p>
      </Section>
    )
  }

  return (
    <Section id="passes" title="Passes">
      <ul className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">
        {passes.map((pass) => (
          <li key={pass.id} className="border-t border-border py-8 xl:border-t-0 xl:border-l xl:pl-6 xl:first:border-l-0 xl:first:pl-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="display text-step-2">{pass.name}</h3>
              {pass.recommended ? <span className="badge">Recommended</span> : null}
            </div>

            <p className="mono mt-3 text-step-1">{pass.price ?? 'Price announced soon'}</p>

            <ul className="mt-6 flex flex-col gap-2 text-step--1">
              {/* Lunch is merged in here so a new tier cannot forget to say so. */}
              {[...pass.includes, ...ALWAYS_INCLUDED].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <dl className="mt-6 flex flex-col gap-2 text-step--1 text-muted">
              <div className="flex gap-2">
                <dt>Swag</dt>
                <dd>{pass.swag ?? 'To be confirmed'}</dd>
              </div>
              <div className="flex gap-2">
                <dt>Sessions</dt>
                <dd>{pass.sessionsAllowed === null ? 'To be confirmed' : `${pass.sessionsAllowed} of the day`}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Only shown once a real expiry exists. Never invent urgency. */}
      {earlyBirdEndsAt ? (
        <p className="measure mt-12 text-step--1 text-muted">
          Early bird pricing ends on {earlyBirdEndsAt}. Prices rise after that date.
        </p>
      ) : null}
    </Section>
  )
}
