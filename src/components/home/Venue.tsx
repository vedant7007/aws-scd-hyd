import { Section } from '@/components/layout/Section'
import { travel, venue } from '@/content/event'

export function Venue() {
  const known = travel.filter((item) => item.detail !== null)

  return (
    <Section id="venue" title="Getting there">
      <div className="flex flex-col gap-10">
        <div>
          <h3 className="display text-step-2">{venue.name}</h3>
          <p className="measure mt-3 text-muted">{venue.address}</p>
          <p className="mt-4">
            <a className="link" href={venue.directionsUrl} rel="noreferrer noopener" target="_blank">
              Open in Google Maps
            </a>
          </p>
        </div>

        {known.length > 0 ? (
          <dl className="grid gap-8 sm:grid-cols-2">
            {known.map((item) => (
              <div key={item.label} className="border-t border-border pt-4">
                <dt className="text-step--1 text-muted">{item.label}</dt>
                <dd className="mt-1">{item.detail}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="measure text-muted">
            Metro, bus, cab and parking directions are being confirmed and go here before the day.
          </p>
        )}
      </div>
    </Section>
  )
}
