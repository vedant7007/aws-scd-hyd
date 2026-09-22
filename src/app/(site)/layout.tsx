import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { RevealRoot } from '@/components/motion/RevealRoot'

/**
 * The chrome the screens not yet ported to the design handoff still use. Each
 * screen in the handoff carries its own header and footer, so a screen leaves
 * this group when it is ported and the group goes with the last one.
 */
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <RevealRoot />
    </>
  )
}
