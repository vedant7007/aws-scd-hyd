import { Section } from '@/components/layout/Section'
import { speakers } from '@/content/speakers'

/**
 * Reads correctly with zero speakers, with one, and with many.
 *
 * The empty state is designed rather than apologetic, because it is live for
 * weeks: a confident typographic statement and a row of reserved slots. No
 * placeholder silhouettes and no invented names, per SPEC.md section 11.
 */
export function Speakers({ headingLevel = 2 }: { headingLevel?: 1 | 2 } = {}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  return (
    <Section id="speakers" labelledBy="speakers-h" className="section-tight">
      <Heading id="speakers-h" className="eyebrow">Speakers</Heading>

      {speakers.length === 0 ? (
        <div className="awaiting mt-6" data-reveal>
          <p className="awaiting-head">
            Names go up <em>one at a time</em>, as each is signed
          </p>
          <div className="slot-row" aria-hidden="true">
            <span className="slot" />
            <span className="slot" />
            <span className="slot" />
            <span className="slot" />
          </div>
          <p className="measure text-muted">
            Rather than holding the whole lineup back for one announcement. Check in now and then.
          </p>
        </div>
      ) : (
        <ul className="mt-8" data-reveal-stagger>
          {speakers.map((speaker) => (
            <li key={speaker.name} className="track-item row-hover">
              <h3 className="track-name">{speaker.name}</h3>
              <p className="text-step-1 text-muted">
                {speaker.role}, {speaker.org}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
