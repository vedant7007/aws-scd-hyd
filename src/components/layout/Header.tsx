import Link from 'next/link'
import { event } from '@/content/event'
import { Container } from './Container'
import { StickyHeader } from './StickyHeader'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  return (
    <StickyHeader>
      <Container className="header-inner flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <Link href="/" className="wordmark display text-step-1 text-text no-underline">
          {event.shortName}
        </Link>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <nav aria-label="Main" className="flex flex-wrap gap-x-6 gap-y-2 text-step--1">
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
          <ThemeToggle />
        </div>
      </Container>
    </StickyHeader>
  )
}
