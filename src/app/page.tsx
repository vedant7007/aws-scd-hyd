import { Landing } from '@/components/landing/Landing'
import { formatInr, passes } from '@/content/passes'
import type { Tier } from '@/lib/db/types'
import { eventJsonLd } from '@/lib/jsonld'
import { registrationIsOpen } from '@/lib/tickets/launch'

export default function HomePage() {
  // The one source of prices, formatted here so the page and the checkout can
  // never show different figures. A null price renders as pending.
  const prices = Object.fromEntries(
    passes.map((p) => [p.id, p.pricePaise === null ? null : formatInr(p.pricePaise)]),
  ) as Record<Tier, string | null>

  return (
    <>
      {/* schema.org Event. Nothing asserted that is still TODO(vedant). */}
      <script
        type="application/ld+json"
        // JSON.stringify output built from typed content, never user input.
        dangerouslySetInnerHTML={{ __html: eventJsonLd() }}
      />
      <Landing registrationOpen={registrationIsOpen()} prices={prices} />
    </>
  )
}
