import type { Tier } from '../lib/db/types'

export type Pass = {
  /** The stored key. It is in DynamoDB records, CSV exports and the seed, and is never shown to a person. */
  id: Tier
  /** What a person sees. Rendering the key anywhere is a bug; go through tierLabel. */
  name: string
  /**
   * In paise, so the amount charged and the amount displayed can never
   * disagree. 49900 is Rs 499. Null means not yet decided, and every reader
   * renders that as pending. Never guess a price.
   */
  pricePaise: number | null
  /**
   * What the landing's pass card lists, in order, written out in full on
   * every tier. Deliberately not "everything in Regular" there: a student
   * comparing four cards should never have to hold another in their head.
   * (The registration flow's own cards list only what each tier adds, as
   * the v3 handoff draws them.)
   */
  perks: string[]
  /** TODO(vedant): swag levels unconfirmed. */
  swag: string | null
}

/** Verbatim, on the registration page before the pay button and in the confirmation email. */
export const REFUND_POLICY =
  'Refunds are available if you tell us at least two weeks before the event. Write to awssbgvjit@gmail.com with your pass ID.'

/**
 * Prices are confirmed (24 September 2026) and this is their only home: the
 * landing page, the notify page, the registration flow and the record all
 * read them from here. Rs 499 / 799 / 999 / 1,299. There is no early bird
 * and there are no coupons.
 */
const KEYNOTE = '1 keynote session'
const TECHNICAL = '1 technical session, Cloud Engineering or AI'
const QA = 'Q&A session'
const WORKSHOP = 'Hands-on workshop'
const PANEL = 'Panel discussion'

export const passes: Pass[] = [
  {
    id: 'basic',
    name: 'Regular',
    pricePaise: 49900,
    // Q&A is on every pass, per the v3 handoff (it was Premium and above).
    perks: ['Swag kit · tier 1', 'Lunch', KEYNOTE, TECHNICAL, QA],
    swag: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    pricePaise: 79900,
    perks: ['Swag kit · tier 2', 'Lunch', KEYNOTE, TECHNICAL, QA, WORKSHOP],
    swag: null,
  },
  {
    id: 'ultra',
    name: 'Platinum',
    pricePaise: 99900,
    perks: ['Swag kit · tier 3', 'Lunch', KEYNOTE, TECHNICAL, QA, WORKSHOP, PANEL, 'Reserved seat booking'],
    swag: null,
  },
  {
    id: 'vip',
    name: 'VIP',
    pricePaise: 129900,
    perks: [
      'Swag kit · tier 4',
      'Lunch',
      KEYNOTE,
      TECHNICAL,
      QA,
      WORKSHOP,
      PANEL,
      'Reserved front-row seating',
      'Special networking with speakers',
      'Dedicated VIP assistance',
    ],
    swag: null,
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
