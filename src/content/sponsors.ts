import { event } from './event'

export type SponsorTier = {
  id: string
  name: string
}

export type Sponsor = {
  name: string
  tierId: string
  url: string
}

/**
 * TODO(vedant): sponsor tiers are unconfirmed. Empty is a valid state and
 * renders the whole section as a call for sponsors rather than a blank wall.
 */
export const sponsorTiers: SponsorTier[] = []

/** TODO(vedant): no sponsors confirmed yet. */
export const sponsors: Sponsor[] = []

/** Fixed subject so enquiries are filterable in the inbox. Do not vary it. */
export const SPONSORSHIP_SUBJECT = `Sponsorship, ${event.name}`

export const sponsorshipMailto = `mailto:${event.contactEmail}?subject=${encodeURIComponent(SPONSORSHIP_SUBJECT)}`
