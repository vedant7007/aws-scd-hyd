import { Container } from '@/components/layout/Container'

/** Streamed while the dashboard loads. Mirrors the real layout so nothing jumps. */
export default function Loading() {
  return (
    <Container className="flex flex-col gap-6 py-16" aria-busy="true">
      <p className="text-step--1 text-muted">Loading the dashboard</p>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
    </Container>
  )
}
