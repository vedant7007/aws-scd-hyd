import { event } from '@/content/event'

/**
 * Shown when the id in the URL matches no attendee, or one whose state has
 * no pass to show. Scoped to this segment so it carries pass specific wording
 * rather than a generic 404, and so the response is a real 404 instead of a
 * 200 for something that does not exist. Static: byte for byte the same
 * whatever the id was, so nothing about the record leaks.
 *
 * Never a stack trace, and never a redirect to a login that does not exist,
 * see SPEC.md section 11. No loading.tsx may sit beside this: inside a
 * Suspense boundary notFound() streams as a 200.
 */
export default function PassNotFound() {
  return (
    <div className="page rise">
      <div className="flex flex-col gap-3">
        <span className="lbl-sm">404</span>
        <h1 className="h1">THIS PASS LINK IS NOT VALID</h1>
        <p className="lede">
          Check the link in your confirmation email, it may have been cut short when it was copied. If it still does not work, write to us
          and we will sort it out.
        </p>
      </div>
      <a className="btn self-start" href={`mailto:${event.contactEmail}`}>
        MAIL {event.contactEmail.toUpperCase()}
      </a>
    </div>
  )
}
