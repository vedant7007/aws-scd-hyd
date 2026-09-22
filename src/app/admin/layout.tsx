import type { Metadata } from 'next'
import { SiteFooter, SiteHeader } from '@/components/layout/SiteChrome'

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The crew screens: sign in, the dashboard, the scanner. Same bar as the
 * public screens without the public links; the secure group adds the crew
 * bar once the session is known. Attendees never see any of this.
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <>
      <div className="page-bg" aria-hidden="true" />
      <SiteHeader crew />
      <main id="main" className="relative z-10 flex-1">
        {children}
      </main>
      <SiteFooter crew />
    </>
  )
}
