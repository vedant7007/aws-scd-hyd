import { event } from './event'

export type SponsorTier = {
  id: string
  name: string
}

export type Sponsor = {
  name: string
  tierId: string
  url: string
  /** In public/, square. Absent renders the name in type. */
  logo?: string
  /** One line, theirs. */
  tagline?: string
}

/**
 * Title sponsor is AWS, which funds community events run by students; the
 * sponsors page and the landing say so in copy rather than as a row here.
 * TODO(vedant): the remaining sponsor tiers are unconfirmed. Empty tiers
 * render as open slots with the call for sponsors.
 */
export const sponsorTiers: SponsorTier[] = [{ id: 'community', name: 'Community partner' }]

/** The one confirmed partner, as the landing page already shows it. */
export const sponsors: Sponsor[] = [
  { name: 'CSXIA', tierId: 'community', url: 'https://www.linkedin.com/company/csxia/', logo: '/assets/csxia-logo.jpeg', tagline: 'Engage. Learn. Build. Level up.' },
]

/** Fixed subject so enquiries are filterable in the inbox. Do not vary it. The landing page carries the same string. */
export const SPONSORSHIP_SUBJECT = 'Sponsor - AWS SCD Hyderabad'

export const sponsorshipMailto = `mailto:${event.contactEmail}?subject=${encodeURIComponent(SPONSORSHIP_SUBJECT)}`
