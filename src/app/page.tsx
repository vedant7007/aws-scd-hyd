import { Landing } from '@/components/landing/Landing'
import { doorsLabel } from '@/content/event'
import { EARLY_BIRD_TOTAL, earlyBirdPrice, formatInr, passes } from '@/content/passes'
import type { Tier } from '@/lib/db/types'
import { eventJsonLd } from '@/lib/jsonld'
import { earlyBirdLeft } from '@/lib/registration/state'
import { registrationIsOpen } from '@/lib/tickets/launch'

/**
 * Rendered per request: the early bird count comes from the counter item
 * and the registration switch from the config item, and neither may be
 * shown stale.
 */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [open, left] = await Promise.all([registrationIsOpen(), earlyBirdLeft()])
  const earlyBird = left > 0 ? { left, total: EARLY_BIRD_TOTAL } : null

  // The one source of prices, formatted here so the page and the checkout can
  // never show different figures. A null price renders as pending. The early
  // bird price is set only while the pool has places, so an empty pool
  // leaves no strikethrough and no label behind.
  const prices = Object.fromEntries(
    passes.map((p) => [
      p.id,
      {
        list: p.pricePaise === null ? null : formatInr(p.pricePaise),
        early: p.pricePaise === null || !earlyBird ? null : formatInr(earlyBirdPrice(p.pricePaise)),
      },
    ]),
  ) as Record<Tier, { list: string | null; early: string | null }>

  return (
    <>
      {/* schema.org Event. Nothing asserted that is still TODO(vedant). */}
      <script
        type="application/ld+json"
        // JSON.stringify output built from typed content, never user input.
        dangerouslySetInnerHTML={{ __html: eventJsonLd() }}
      />
      <Landing registrationOpen={open} doors={doorsLabel} prices={prices} earlyBird={earlyBird} />
    </>
  )
}
