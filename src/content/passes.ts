import type { Tier } from '@/lib/db/types'

export type Pass = {
  id: Tier
  name: string
  /** TODO(vedant): null until prices are set. Never guess a price. */
  price: string | null
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
 * TODO(vedant): tier names, prices, inclusions and swag levels are all
 * unconfirmed. These are structural placeholders so the section can be built and
 * laid out. Setting `passes` to [] renders the announced soon state.
 */
export const passes: Pass[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: null,
    includes: ['Entry to all three tracks'],
    swag: null,
    sessionsAllowed: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: null,
    includes: ['Entry to all three tracks', 'Reserved seating'],
    swag: null,
    sessionsAllowed: null,
    recommended: true,
  },
  {
    id: 'ultra',
    name: 'Ultra',
    price: null,
    includes: ['Entry to all three tracks', 'Reserved seating', 'Workshop access'],
    swag: null,
    sessionsAllowed: null,
  },
  {
    id: 'vip',
    name: 'VIP',
    price: null,
    includes: ['Entry to all three tracks', 'Reserved seating', 'Workshop access', 'Speaker dinner'],
    swag: null,
    sessionsAllowed: null,
  },
]

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
