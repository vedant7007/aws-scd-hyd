import { Landing } from '@/components/landing/Landing'
import { eventJsonLd } from '@/lib/jsonld'
import { registrationIsOpen } from '@/lib/tickets/launch'

export default function HomePage() {
  return (
    <>
      {/* schema.org Event. Nothing asserted that is still TODO(vedant). */}
      <script
        type="application/ld+json"
        // JSON.stringify output built from typed content, never user input.
        dangerouslySetInnerHTML={{ __html: eventJsonLd() }}
      />
      <Landing registrationOpen={registrationIsOpen()} />
    </>
  )
}
