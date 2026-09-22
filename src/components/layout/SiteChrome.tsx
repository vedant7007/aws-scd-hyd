import Link from 'next/link'
import { event } from '@/content/event'
import { ThemeToggle } from './ThemeToggle'

/**
 * The header and footer every screen after the landing shares, from the
 * handoff's sibling screens: a sticky bar with the wordmark and the toggle,
 * a compact footer with the legal line. The three section links the old
 * chrome carried stay, at a 44px tap height, with REGISTER as the one
 * filled control. Nothing here reads the table, so static pages stay static.
 */
export function SiteHeader({ crew = false }: { crew?: boolean }) {
  return (
    <header className="site-bar">
      <Link href="/" className="wordmark">
        &lt; SCD<span className="text-amber-ink">.</span>HYD 26
      </Link>
      {crew ? null : (
        <nav className="site-links" aria-label="Main">
          <Link href="/schedule">SCHEDULE</Link>
          <Link href="/speakers">SPEAKERS</Link>
          <Link href="/sponsors">SPONSORS</Link>
        </nav>
      )}
      <div className="site-ctl">
        <ThemeToggle />
        {crew ? null : (
          <Link href="/register" className="btn btn-primary btn-sm">
            REGISTER
          </Link>
        )}
      </div>
    </header>
  )
}

export function SiteFooter({ crew = false }: { crew?: boolean }) {
  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        <div className="foot-links">
          <Link href="/" className="foot-link">
            AWSSCDHYD.IN
          </Link>
          {crew ? (
            <Link href="/admin" className="foot-link">
              CREW
            </Link>
          ) : (
            <>
              <Link href="/code-of-conduct" className="foot-link">
                CODE OF CONDUCT
              </Link>
              <Link href="/pass" className="foot-link">
                MY PASS
              </Link>
            </>
          )}
          <a href={`mailto:${event.contactEmail}`} className="foot-mail">
            {event.contactEmail}
          </a>
        </div>
        <p className="legal">{event.disclaimer}</p>
      </div>
    </footer>
  )
}
