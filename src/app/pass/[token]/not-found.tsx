import { Container } from '@/components/layout/Container'
import { event } from '@/content/event'

/**
 * Shown when the token in the URL matches no attendee. Scoped to this segment
 * so it carries pass specific wording rather than a generic 404, and so the
 * response is a real 404 instead of a 200 for something that does not exist.
 *
 * Never a stack trace, and never a redirect to a login that does not exist,
 * see SPEC.md section 11.
 */
export default function PassNotFound() {
  return (
    <Container className="measure flex flex-col gap-6 py-24">
      <h1 className="display text-step-3">This pass link is not valid</h1>
      <p className="text-step-1 text-muted">
        Check the link in your confirmation email, it may have been cut short when it was copied. If it
        still does not work, write to us and we will sort it out.
      </p>
      <p>
        <a className="link" href={`mailto:${event.contactEmail}`}>
          {event.contactEmail}
        </a>
      </p>
    </Container>
  )
}
