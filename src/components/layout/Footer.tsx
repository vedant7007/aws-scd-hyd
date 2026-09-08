import { event } from '@/content/event'
import { Container } from './Container'

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <Container className="flex flex-col gap-8 py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="display text-step-2">{event.shortName}</p>
          <a className="link" href={`mailto:${event.contactEmail}`}>
            {event.contactEmail}
          </a>
        </div>

        <p className="measure text-step--1 text-muted">{event.disclaimer}</p>

        {/* TODO(vedant): socials and the code of conduct link go here once the
            copy arrives and /code-of-conduct exists. No dead links until then. */}
      </Container>
    </footer>
  )
}
