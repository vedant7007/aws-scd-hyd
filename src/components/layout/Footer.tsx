import Link from 'next/link'
import { event } from '@/content/event'
import { Container } from './Container'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-10 py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-6">
          <p className="display text-step-2">{event.shortName}</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-2">
            <a className="link" href={`mailto:${event.contactEmail}`}>
              {event.contactEmail}
            </a>
            <Link className="link" href="/code-of-conduct">
              Code of conduct
            </Link>
          </nav>
        </div>

        {/* TODO(vedant): social handles not supplied. Links go here once they are,
            deliberately absent rather than pointing at accounts that may not exist. */}

        <p className="measure text-step--1 text-muted">{event.disclaimer}</p>
      </Container>
    </footer>
  )
}
