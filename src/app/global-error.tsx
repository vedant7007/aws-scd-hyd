'use client'

/**
 * Catches failures in the root layout itself, where the normal boundary cannot
 * run. It has to render its own html and body, and it cannot rely on the app's
 * stylesheet having loaded, so the few values here are unavoidable and are the
 * one place in the codebase not driven by tokens.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ fontFamily: 'system-ui, sans-serif', margin: '4rem auto', maxWidth: '38rem', padding: '0 1.25rem' }}>
          <h1>The site failed to load</h1>
          <p>Something broke before the page could render. Reloading usually fixes it.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
          {error.digest ? <p>Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  )
}
