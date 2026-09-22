import type { Tier } from '../lib/db/types'

export type Pass = {
  id: Tier
  name: string
  /**
   * In paise, the unit the gateway bills in, so the amount charged and the
   * amount displayed can never disagree. 39900 is Rs 399. Null means not yet
   * decided, and every reader renders that as pending. Never guess a price.
   */
  pricePaise: number | null
  /** Tier specific inclusions. Lunch is added to every tier, see ALWAYS_INCLUDED. */
  includes: string[]
  /** TODO(vedant): swag levels unconfirmed. */
  swag: string | null
  /** SPEC.md section 9. How many slots this tier may fill. Null means undecided. */
  sessionsAllowed: number | null
  recommended?: boolean
}

/**
 * SPEC.md section 11 item 6: lunch is included on every tier and must say so on
 * every tier. Kept here and merged in by the component so a new tier cannot
 * accidentally omit it.
 */
export const ALWAYS_INCLUDED = ['Lunch on the day']

/** TODO(vedant): early bird expiry undecided. The price rise note is hidden until this is set. */
export const earlyBirdEndsAt: string | null = null

/**
 * Prices are confirmed (22 September 2026) and this is their only home: the
 * landing page and the checkout both read them from here.
 *
 * TODO(vedant): names, inclusions and swag levels are still unconfirmed here.
 * The landing page carries the handoff's names (Regular, Platinum) and
 * inclusion lists as static copy; bring these fields in line with it. Setting
 * `passes` to [] renders the announced soon state.
 */
export const passes: Pass[] = [
  {
    id: 'basic',
    name: 'Basic',
    pricePaise: 39900,
    includes: ['Entry to all three tracks'],
    swag: null,
    sessionsAllowed: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    pricePaise: 79900,
    includes: ['Entry to all three tracks', 'Reserved seating'],
    swag: null,
    sessionsAllowed: null,
    recommended: true,
  },
  {
    id: 'ultra',
    name: 'Ultra',
    pricePaise: 129900,
    includes: ['Entry to all three tracks', 'Reserved seating', 'Workshop access'],
    swag: null,
    sessionsAllowed: null,
  },
  {
    id: 'vip',
    name: 'VIP',
    pricePaise: 169900,
    includes: ['Entry to all three tracks', 'Reserved seating', 'Workshop access', 'Speaker dinner'],
    swag: null,
    sessionsAllowed: null,
  },
]

/** Rs 499, not 499.00: student pricing is whole rupees and the .00 is noise. */
export const formatInr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0 }).format(
    paise / 100,
  )

/** The tier ids that exist, for validation. Read from the data, never listed twice. */
export const tierIds = passes.map((p) => p.id)

export const passFor = (tier: Tier): Pass | undefined => passes.find((p) => p.id === tier)

/**
 * SPEC.md section 9. How many slots a tier may fill, read from here and never
 * hardcoded at a call site.
 *
 * TODO(vedant): every tier is null, meaning undecided. Null is treated as no
 * cap beyond the one-per-slot rule the table key already enforces. Set real
 * numbers and the picker starts refusing extra slots with no other change.
 */
export function sessionsAllowedFor(tier: Tier): number | null {
  return passes.find((p) => p.id === tier)?.sessionsAllowed ?? null
}
