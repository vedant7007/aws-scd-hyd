import { SiteFooter, SiteHeader } from '@/components/layout/SiteChrome'

/** The public screens after the landing. The landing carries its own chrome. */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <div className="page-bg" aria-hidden="true" />
      <SiteHeader />
      <main id="main" className="relative z-10 flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
