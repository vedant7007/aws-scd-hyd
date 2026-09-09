import { Section } from '@/components/layout/Section'
import { travel, venue } from '@/content/event'

export function Venue() {
  const known = travel.filter((item) => item.detail !== null)

  return (
    <Section id="venue" labelledBy="venue-h" className="section-tight">
      <div className="field-grid" data-reveal-stagger>
        <h2 id="venue-h" className="eyebrow col-span-full lg:col-span-3">Getting there</h2>

        <div className="col-span-full lg:col-span-9 lg:col-start-4">
          <p className="display text-step-3">{venue.name}</p>
          {venue.address ? <p className="measure mt-4 text-step-1 text-muted">{venue.address}</p> : null}
          <p className="mt-6">
            <a className="cta-quiet" href={venue.directionsUrl} rel="noreferrer noopener" target="_blank">
              Open in Google Maps
            </a>
          </p>

          {known.length > 0 ? (
            <dl className="mt-12 grid gap-8 sm:grid-cols-2">
              {known.map((item) => (
                <div key={item.label} className="rule-top pt-4">
                  <dt className="eyebrow">{item.label}</dt>
                  <dd className="mt-1">{item.detail}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="measure mt-12 rule-top pt-4 text-muted">
              Metro, bus, cab and parking directions are being confirmed and go here before the day.
            </p>
          )}
        </div>
      </div>
    </Section>
  )
}
