'use client'

import { useEffect } from 'react'
import { Container } from '@/components/layout/Container'
import { event } from '@/content/event'

/**
 * Segment error boundary. Shows a plain apology and a way forward, never the
 * error text, which can carry table names or query detail.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest is the only thing safe to show. The message goes to the server
    // log, where it belongs, not onto a public page.
    console.error('[boundary]', error.digest ?? 'no digest', error.message)
  }, [error])

  return (
    <Container className="measure flex flex-col gap-6 py-24">
      <h1 className="display text-step-3">That did not load</h1>
      <p className="text-step-1 text-muted">
        Something on our side failed. Trying again often works, because most of these are momentary.
      </p>
      <div className="flex flex-wrap gap-4">
        <button type="button" className="cta" onClick={reset}>
          Try again
        </button>
        <a className="cta-quiet" href={`mailto:${event.contactEmail}`}>
          Tell us
        </a>
      </div>
      {error.digest ? <p className="mono text-step--1 text-muted">Reference {error.digest}</p> : null}
    </Container>
  )
}
