import { Section } from '@/components/layout/Section'
import { about } from '@/content/event'

/**
 * Asymmetric on purpose: a small label held left against a wide lead, with the
 * first sentence set large and the rest quiet underneath it. The hierarchy is
 * carried by size contrast rather than by another centred column of body text.
 */
export function About() {
  const [lead, ...rest] = about

  return (
    <Section id="about" labelledBy="about-h" className="section-tight">
      <div className="field-grid" data-reveal-stagger>
        <h2 id="about-h" className="eyebrow col-span-full lg:col-span-3">What this is</h2>

        <div className="col-span-full lg:col-span-8 lg:col-start-5">
          {lead ? <p className="text-step-2 display">{lead}</p> : null}
          <div className="measure mt-8 flex flex-col gap-4 text-muted">
            {rest.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}
