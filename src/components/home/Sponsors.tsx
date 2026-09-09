import { Section } from '@/components/layout/Section'
import { SPONSORSHIP_SUBJECT, sponsorTiers, sponsors, sponsorshipMailto } from '@/content/sponsors'

export function Sponsors({ headingLevel = 2 }: { headingLevel?: 1 | 2 } = {}) {
  // Sits one level under the section heading, so it never skips a level.
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const SubHeading = headingLevel === 1 ? 'h2' : 'h3'

  const populated = sponsorTiers
    .map((tier) => ({ tier, list: sponsors.filter((s) => s.tierId === tier.id) }))
    .filter(({ list }) => list.length > 0)

  return (
    <Section id="sponsors" labelledBy="sponsors-h" className="section-tight">
      <Heading id="sponsors-h" className="eyebrow">Sponsors</Heading>

      {populated.length === 0 ? (
        /* Empty for weeks, so it is built as a pitch rather than a gap. */
        <div className="awaiting mt-6" data-reveal>
          <p className="awaiting-head">
            A room full of students who <em>build things</em>
          </p>
          <div className="slot-row" aria-hidden="true">
            <span className="slot" />
            <span className="slot" />
            <span className="slot" />
          </div>
          <p className="measure text-muted">
            There is space here for your name, and the prospectus is one email away.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-12" data-reveal-stagger>
          {populated.map(({ tier, list }) => (
            <div key={tier.id}>
              <SubHeading className="eyebrow">{tier.name}</SubHeading>
              <ul className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
                {list.map((sponsor) => (
                  <li key={sponsor.name} className="text-step-2">
                    <a className="link" href={sponsor.url} rel="noreferrer noopener" target="_blank">
                      {sponsor.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="measure mt-12 rule-top pt-8">
        <SubHeading className="display text-step-2">Become a sponsor</SubHeading>
        <p className="mt-4 text-muted">Write to us with the subject below and we will send the prospectus.</p>
        <p className="numeral mt-4">{SPONSORSHIP_SUBJECT}</p>
        <p className="mt-6">
          <a className="cta" href={sponsorshipMailto}>
            Email us
          </a>
        </p>
      </div>
    </Section>
  )
}
