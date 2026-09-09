import type { ReactNode } from 'react'
import { Container } from './Container'

/**
 * A landmark plus the page gutter, and nothing else. It carries no heading of
 * its own so each section can choose its own type hierarchy, but it keeps the
 * region landmark and the accessible name that a bare div would lose.
 */
export function Section({
  id,
  labelledBy,
  className = '',
  children,
}: {
  id: string
  labelledBy: string
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`cv-auto ${className}`}>
      <Container>{children}</Container>
    </section>
  )
}
