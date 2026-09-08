import { Section } from '@/components/layout/Section'
import { SPONSORSHIP_SUBJECT, sponsorTiers, sponsors, sponsorshipMailto } from '@/content/sponsors'

export function Sponsors() {
  const populated = sponsorTiers
    .map((tier) => ({ tier, list: sponsors.filter((s) => s.tierId === tier.id) }))
    .filter(({ list }) => list.length > 0)

  return (
    <Section id="sponsors" title="Sponsors">
      {populated.length === 0 ? (
        <p className="measure text-step-1 text-muted">
          Sponsors are being confirmed. This is a room full of students who build things, and there is space
          for your name on it.
        </p>
      ) : (
        <div className="flex flex-col gap-12">
          {populated.map(({ tier, list }) => (
            <div key={tier.id}>
              <h3 className="text-step--1 text-muted">{tier.name}</h3>
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

      <div className="measure mt-16 border-t border-border pt-8">
        <h3 className="display text-step-2">Become a sponsor</h3>
        <p className="mt-4 text-muted">
          Write to us with the subject below and we will send the prospectus.
        </p>
        <p className="mono mt-4 text-step--1">{SPONSORSHIP_SUBJECT}</p>
        <p className="mt-6">
          <a className="cta" href={sponsorshipMailto}>
            Email us
          </a>
        </p>
      </div>
    </Section>
  )
}
