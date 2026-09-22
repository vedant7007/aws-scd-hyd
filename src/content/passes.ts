import type { Tier } from '../lib/db/types'

export type Pass = {
  /** The stored key. It is in DynamoDB records, CSV exports, order notes and the seed, and is never shown to a person. */
  id: Tier
  /** What a person sees. Rendering the key anywhere is a bug; go through tierLabel. */
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
  /**
   * How many DISTINCT tracks the tier may draw sessions from. This is the tier
   * constraint: at registration a student picks up to this many tracks and a
   * seat is held in every session of each. Not a count of sessions.
   */
  tracksAllowed: number
  /** Unused. Track allowance replaced it as the tier constraint; kept null so nothing reads it by accident. */
  sessionsAllowed: null
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
 * Names are confirmed: Regular, Premium, Platinum, VIP.
 *
 * TODO(vedant): inclusions and swag levels are still unconfirmed here. The
 * landing page carries the handoff's inclusion lists as static copy; bring
 * `includes` in line with it. Setting `passes` to [] renders the announced
 * soon state.
 *
 * No tier promises workshops: none are decided. No tier states how many
 * tracks or sessions it covers: that is sessionsAllowed, still null. No early
 * bird and no coupons: earlyBirdEndsAt stays null and there is no discount
 * logic. The handoff's Register screen carries demo codes (EARLYBIRD,
 * SBGVJIT, CAMPUS5) that must not come across when it is ported.
 */
export const passes: Pass[] = [
  {
    id: 'basic',
    name: 'Regular',
    pricePaise: 39900,
    includes: [],
    swag: null,
    tracksAllowed: 1,
    sessionsAllowed: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    pricePaise: 79900,
    includes: ['Reserved seating'],
    swag: null,
    tracksAllowed: 2,
    sessionsAllowed: null,
    recommended: true,
  },
  {
    id: 'ultra',
    name: 'Platinum',
    pricePaise: 129900,
    includes: ['Reserved seating'],
    swag: null,
    tracksAllowed: 3,
    sessionsAllowed: null,
  },
  {
    id: 'vip',
    name: 'VIP',
    pricePaise: 169900,
    includes: ['Reserved seating', 'Speaker dinner'],
    swag: null,
    tracksAllowed: 3,
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
 * The name a person sees for a stored tier key. Falls back to the key only for
 * a value that is not a tier at all, which a typed record cannot hold.
 */
export const tierLabel = (tier: Tier | string): string => passes.find((p) => p.id === tier)?.name ?? tier

/** The tier constraint. How many distinct tracks this tier may register for. */
export function tracksAllowedFor(tier: Tier): number {
  return passes.find((p) => p.id === tier)?.tracksAllowed ?? 1
}
