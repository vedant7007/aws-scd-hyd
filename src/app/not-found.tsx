import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

/**
 * Unmatched URLs render inside the root layout, outside the (site) group, so
 * this page brings the chrome itself.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <Container className="measure flex flex-col gap-6 py-24">
          <p className="mono text-step--1 text-muted">404</p>
          <h1 className="display text-step-4">That page is not here</h1>
          <p className="text-step-1 text-muted">
            The link may be out of date, or the page may not exist yet. Plenty of this site is still being
            built.
          </p>
          <nav aria-label="Useful links" className="flex flex-wrap gap-x-8 gap-y-2">
            <Link className="link" href="/">
              Home
            </Link>
            <Link className="link" href="/schedule">
              Schedule
            </Link>
            <Link className="link" href="/speakers">
              Speakers
            </Link>
            <Link className="link" href="/sponsors">
              Sponsors
            </Link>
          </nav>
        </Container>
      </main>
      <Footer />
    </>
  )
}
