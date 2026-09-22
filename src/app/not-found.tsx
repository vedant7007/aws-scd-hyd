import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/layout/SiteChrome'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

/**
 * Unmatched URLs render inside the root layout, outside every route group,
 * so this page brings the chrome itself.
 */
export default function NotFound() {
  return (
    <>
      <div className="page-bg" aria-hidden="true" />
      <SiteHeader />
      <main id="main" className="relative z-10 flex-1">
        <div className="page rise">
          <div className="flex flex-col gap-3">
            <span className="lbl-sm">404</span>
            <h1 className="h1">THAT PAGE IS NOT HERE</h1>
            <p className="lede">The link may be out of date, or the page may not exist yet.</p>
          </div>
          <nav aria-label="Useful links" className="flex flex-wrap gap-2.5">
            <Link href="/" className="btn btn-ink">
              HOME
            </Link>
            <Link href="/schedule" className="btn">
              SCHEDULE
            </Link>
            <Link href="/pass" className="btn">
              MY PASS
            </Link>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
