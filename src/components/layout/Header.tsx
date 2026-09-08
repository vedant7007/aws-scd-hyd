import Link from 'next/link'
import { event } from '@/content/event'
import { Container } from './Container'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  return (
    <header className="border-b border-border">
      <Container className="flex items-center justify-between gap-6 py-4">
        <Link href="/" className="display text-step-1 no-underline text-text">
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
    </header>
  )
}
