import { Section } from '@/components/layout/Section'
import { speakers } from '@/content/speakers'

/**
 * Reads correctly with zero speakers, with one, and with many. No placeholder
 * silhouettes and no fake rows, see SPEC.md section 11 item 5.
 */
export function Speakers({ headingLevel }: { headingLevel?: 1 | 2 } = {}) {
  return (
    <Section headingLevel={headingLevel} id="speakers" title="Speakers">
      {speakers.length === 0 ? (
        <p className="measure text-step-1 text-muted">
          The lineup is being confirmed. Names go up here as soon as each one is signed, rather than all at
          once at the end.
        </p>
      ) : (
        <ul>
          {speakers.map((speaker) => (
            <li key={speaker.name} className="border-t border-border py-8 first:border-t-0 first:pt-0">
              <h3 className="display text-step-2">{speaker.name}</h3>
              <p className="mt-2 text-muted">
                {speaker.role}, {speaker.org}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
