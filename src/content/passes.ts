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
  /** Tier specific inclusions. Lunch is added to every tier, see ALWAYS_INCLUDED. Read by the parked registration flow only. */
  includes: string[]
  /**
   * What the pass card lists, in order, written out in full on every tier.
   * Deliberately not "everything in Regular": a student comparing four cards
   * should never have to hold another card in their head.
   */
  perks: string[]
  /** TODO(vedant): swag levels unconfirmed. */
  swag: string | null
  /**
   * How many tracks the tier may PICK SESSIONS FROM, counting the home track
   * chosen at registration. Regular picks only from its home track; Premium
   * from home plus one other; Platinum and VIP from all three. It is not a
   * number of seats: every attendee holds exactly one seat per slot, four in
   * all, whatever the tier. The number is unchanged from the earlier model
   * where it meant tracks held; the meaning is not. Amendment 1, Q3.
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

/**
 * Early bird, by the organiser's decision: fifty rupees off every tier for
 * the first fifty registrations across all tiers combined, live from the
 * moment registration opens. The pool is the EARLYBIRD counter item; these
 * two numbers are its ceiling and the discount the step one transaction
 * locks into the record.
 */
export const EARLY_BIRD_TOTAL = 50
export const EARLY_BIRD_DISCOUNT_PAISE = 5000
export const earlyBirdPrice = (pricePaise: number) => Math.max(0, pricePaise - EARLY_BIRD_DISCOUNT_PAISE)

/** Verbatim, on the registration page before the pay button and in the confirmation email. */
export const REFUND_POLICY =
  'Refunds are available if you tell us at least two weeks before the event. Write to awssbgvjit@gmail.com with your pass ID.'

/**
 * Prices are confirmed (24 September 2026, replacing the 22 September set)
 * and this is their only home: the landing page, the notify page and the
 * parked checkout all read them from here. Rs 499 / 799 / 999 / 1,299.
 *
 * Names are confirmed: Regular, Premium, Platinum, VIP.
 *
 * TODO(vedant): inclusions and swag levels are still unconfirmed here. The
 * landing page carries the handoff's inclusion lists as static copy; bring
 * `includes` in line with it. Setting `passes` to [] renders the announced
 * soon state.
 *
 * No tier promises workshops: none are decided. No tier states how many
 * tracks or sessions it covers: that is sessionsAllowed, still null. No
 * coupons: the handoff's Register screen carries demo codes (EARLYBIRD,
 * SBGVJIT, CAMPUS5) that must not come across. The only discount is the
 * early bird pool above.
 */
const KEYNOTE = '1 keynote session'
const TECHNICAL = '1 technical session, Cloud Engineering or AI'
const QA = 'Q and A session'
const WORKSHOP = 'Hands-on workshop'
const PANEL = 'Panel discussion'

export const passes: Pass[] = [
  {
    id: 'basic',
    name: 'Regular',
    pricePaise: 49900,
    perks: ['Swag kit, tier 1', 'Lunch', KEYNOTE, TECHNICAL],
    includes: [],
    swag: null,
    tracksAllowed: 1,
    sessionsAllowed: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    pricePaise: 79900,
    perks: ['Swag kit, tier 2', 'Lunch', KEYNOTE, TECHNICAL, QA, WORKSHOP],
    includes: ['Reserved seating'],
    swag: null,
    tracksAllowed: 2,
    sessionsAllowed: null,
    recommended: true,
  },
  {
    id: 'ultra',
    name: 'Platinum',
    pricePaise: 99900,
    perks: ['Swag kit, tier 3', 'Lunch', KEYNOTE, TECHNICAL, QA, WORKSHOP, PANEL],
    includes: ['Reserved seating'],
    swag: null,
    tracksAllowed: 3,
    sessionsAllowed: null,
  },
  {
    id: 'vip',
    name: 'VIP',
    pricePaise: 129900,
    perks: [
      'Swag kit, tier 4',
      'Lunch',
      KEYNOTE,
      TECHNICAL,
      QA,
      WORKSHOP,
      PANEL,
      'Reserved front-row seating',
      'Speaker group photo',
      'Special networking with speakers',
      'Dedicated VIP assistance',
    ],
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

/** The tier constraint. How many tracks, home track included, this tier may pick sessions from. */
export function tracksAllowedFor(tier: Tier): number {
  return passes.find((p) => p.id === tier)?.tracksAllowed ?? 1
}
