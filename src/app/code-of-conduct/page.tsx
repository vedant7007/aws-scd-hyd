import type { Metadata } from 'next'
import { Container } from '@/components/layout/Container'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Code of conduct, ${event.shortName}`,
  description: `The code of conduct for ${event.name}.`,
}

/**
 * TODO(vedant): the real code of conduct text is blocked on you, see SPEC.md
 * section 15. This page exists now so the footer link is not dead, and so the
 * URL is stable before anything is printed on a badge or a poster. Replace the
 * body below wholesale. Do not ship the event with this placeholder live.
 */
export default function CodeOfConductPage() {
  return (
    <Container className="measure flex flex-col gap-6 py-20 sm:py-28">
      <h1 className="display text-step-4">Code of conduct</h1>

      <p className="text-step-1 text-muted">
        The full code of conduct is being finalised and will be published here before registration opens.
      </p>

      <p>
        In the meantime, the short version: this is a student event and everyone is welcome at it. Harassment
        of any kind is not tolerated, from attendees, speakers, volunteers or sponsors. If something happens,
        find a volunteer in an organiser shirt or write to us and we will deal with it.
      </p>

      <p>
        Reports go to{' '}
        <a className="link" href={`mailto:${event.contactEmail}`}>
          {event.contactEmail}
        </a>
        .
      </p>
    </Container>
  )
}
