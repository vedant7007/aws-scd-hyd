import type { CSSProperties } from 'react'
import { Section } from '@/components/layout/Section'
import { ALWAYS_INCLUDED, earlyBirdEndsAt, passes } from '@/content/passes'

/**
 * Four tiers read as one comparison rather than four boxes: a single grid,
 * hairline separated, every column carrying the same rows in the same order so
 * the eye can travel across them.
 *
 * The column count comes from the data, so this holds for three tiers or five,
 * and an empty array falls back to the announcement state.
 */
export function Passes() {
  if (passes.length === 0) {
    return (
      <Section id="passes" labelledBy="passes-h" className="section-tight">
        <h2 id="passes-h" className="eyebrow">Passes</h2>
        <div className="awaiting mt-6">
          <p className="awaiting-head">
            Tiers and prices are <em>announced soon</em>
          </p>
          <p className="measure text-muted">Lunch is included on every tier, whatever they turn out to be.</p>
        </div>
      </Section>
    )
  }

  return (
    <Section id="passes" labelledBy="passes-h" className="section-tight">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="passes-h" className="eyebrow">Passes</h2>
        <p className="text-step--1 text-muted">Lunch is included on every tier.</p>
      </div>

      <div
        className="tier-grid mt-8"
        style={{ '--tier-count': passes.length } as CSSProperties}
      >
        {passes.map((pass) => (
          <div key={pass.id} className="tier-col" data-recommended={pass.recommended ? 'true' : undefined}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="tier-name">{pass.name}</h3>
              {pass.recommended ? <span className="badge">Pick</span> : null}
            </div>

            {/* Never invent a price. Pending reads as pending. */}
            <p className="tier-price" data-pending={pass.price ? undefined : 'true'}>
              {pass.price ?? 'Announced soon'}
            </p>

            <ul className="tier-list">
              {[...pass.includes, ...ALWAYS_INCLUDED].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <dl className="tier-meta">
              <div className="flex justify-between gap-2">
                <dt>Swag</dt>
                <dd>{pass.swag ?? 'To be confirmed'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Sessions</dt>
                <dd>{pass.sessionsAllowed === null ? 'To be confirmed' : pass.sessionsAllowed}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* Only shown once a real expiry exists. Never invent urgency. */}
      {earlyBirdEndsAt ? (
        <p className="measure mt-8 text-step--1 text-muted">
          Early bird pricing ends on {earlyBirdEndsAt}. Prices rise after that date.
        </p>
      ) : null}
    </Section>
  )
}
