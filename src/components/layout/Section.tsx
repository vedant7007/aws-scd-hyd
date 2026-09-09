import type { ReactNode } from 'react'
import { Container } from './Container'

export function Section({
  id,
  title,
  lead,
  children,
  /** h2 inside the landing page, h1 when the section is a page of its own. */
  headingLevel = 2,
}: {
  id: string
  title: string
  lead?: string
  children: ReactNode
  headingLevel?: 1 | 2
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="border-t border-border">
      <Container className="py-20 sm:py-28">
        <Heading id={`${id}-heading`} className="display text-step-3">
          {title}
        </Heading>
        {lead ? <p className="measure mt-6 text-step-1 text-muted">{lead}</p> : null}
        <div className="mt-12">{children}</div>
      </Container>
    </section>
  )
}
