import { Section } from '@/components/layout/Section'
import { faq } from '@/content/faq'

/**
 * Native details and summary. Keyboard operable, screen reader announced and
 * open by default without JavaScript, none of which a hand rolled accordion
 * gets for free.
 */
export function Faq() {
  if (faq.length === 0) return null

  return (
    <Section id="faq" title="Questions">
      <div className="faq measure">
        {faq.map((item) => (
          <details key={item.q} className="border-t border-border">
            <summary className="text-step-1">{item.q}</summary>
            <p className="pb-6 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}
