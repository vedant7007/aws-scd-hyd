import { Section } from '@/components/layout/Section'
import { faq } from '@/content/faq'

/**
 * Native details and summary. Keyboard operable, screen reader announced and
 * open by default without JavaScript, none of which a hand rolled accordion
 * gets for free. The marker rotation and hover colour are the only additions.
 */
export function Faq() {
  if (faq.length === 0) return null

  return (
    <Section id="faq" labelledBy="faq-h" className="section-tight">
      <div className="field-grid">
        <h2 id="faq-h" className="eyebrow col-span-full lg:col-span-3">Questions</h2>

        <div className="faq col-span-full lg:col-span-8 lg:col-start-5">
          {faq.map((item) => (
            <details key={item.q} className="rule-top">
              <summary className="text-step-1">{item.q}</summary>
              <p className="measure pb-6 text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}
