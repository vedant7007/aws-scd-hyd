import type { ReactNode } from 'react'
import { Container } from './Container'

export function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="border-t border-border">
      <Container className="py-20 sm:py-28">
        <h2 id={`${id}-heading`} className="display text-step-3">
          {title}
        </h2>
        {lead ? <p className="measure mt-6 text-step-1 text-muted">{lead}</p> : null}
        <div className="mt-12">{children}</div>
      </Container>
    </section>
  )
}
