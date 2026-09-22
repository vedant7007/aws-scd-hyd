'use client'

import { useEffect } from 'react'
import { event } from '@/content/event'

/**
 * Segment error boundary. Shows a plain apology and a way forward, never the
 * error text, which can carry table names or query detail.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is the only thing safe to show. The message goes to the server
    // log, where it belongs, not onto a public page.
    console.error('[boundary]', error.digest ?? 'no digest', error.message)
  }, [error])

  return (
    <div className="page rise">
      <div className="flex flex-col gap-3">
        <span className="lbl-sm">Error</span>
        <h1 className="h1">THAT DID NOT LOAD</h1>
        <p className="lede">Something on our side failed. Trying again often works, because most of these are momentary.</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="btn btn-primary" onClick={reset}>
          TRY AGAIN
        </button>
        <a className="btn" href={`mailto:${event.contactEmail}`}>
          TELL US
        </a>
      </div>
      {error.digest ? <p className="num text-[11px] text-muted">Reference {error.digest}</p> : null}
    </div>
  )
}
