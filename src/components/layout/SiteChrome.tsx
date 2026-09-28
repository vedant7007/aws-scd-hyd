import Link from 'next/link'
import { event } from '@/content/event'
import { ThemeToggle } from './ThemeToggle'

/**
 * The header and footer every screen after the landing shares, as the v3
 * handoff draws them on its sibling screens: a sticky bar with the "< SCD.HYD
 * 26" wordmark back to the home page and the theme toggle, and a footer with
 * the site name and the legal line. No section links: the home page carries
 * those. Crew screens keep their own link back to the dashboard. Nothing here
 * reads the table, so static pages stay static. The header is the same for
 * crew and public screens; only the footer differs.
 */
export function SiteHeader() {
  return (
    <header className="site-bar">
      <Link href="/" className="wordmark">
        &lt; SCD<span className="text-amber-ink">.</span>HYD 26
      </Link>
      <div className="site-ctl">
        <ThemeToggle />
      </div>
    </header>
  )
}

export function SiteFooter({ crew = false }: { crew?: boolean }) {
  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        {crew ? (
          <div className="foot-links">
            <Link href="/" className="foot-link">
              AWSSCDHYD.IN
            </Link>
            <Link href="/admin" className="foot-link">
              CREW
            </Link>
            <a href={`mailto:${event.contactEmail}`} className="foot-mail">
              {event.contactEmail}
            </a>
          </div>
        ) : (
          <Link href="/" className="foot-site">
            awsscdhyd.in
          </Link>
        )}
        <p className="legal">{event.disclaimer}</p>
      </div>
    </footer>
  )
}
