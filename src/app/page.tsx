import { Landing } from '@/components/landing/Landing'
import { doorsLabel } from '@/content/event'
import { formatInr, passes } from '@/content/passes'
import type { Tier } from '@/lib/db/types'
import { eventJsonLd } from '@/lib/jsonld'
import { registrationIsOpen } from '@/lib/tickets/launch'

/** Rendered per request: the registration switch comes from the config item and may not be shown stale. */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const open = await registrationIsOpen()

  // The one source of prices, formatted here so the page and the checkout can
  // never show different figures. A null price renders as pending. There is
  // no early bird in the v3 handoff, so there is no second figure to show.
  const prices = Object.fromEntries(passes.map((p) => [p.id, p.pricePaise === null ? null : formatInr(p.pricePaise)])) as Record<Tier, string | null>

  return (
    <>
      {/* schema.org Event. Nothing asserted that is still TODO(vedant). */}
      <script
        type="application/ld+json"
        // JSON.stringify output built from typed content, never user input.
        dangerouslySetInnerHTML={{ __html: eventJsonLd() }}
      />
      <Landing registrationOpen={open} doors={doorsLabel} prices={prices} />
    </>
  )
}
