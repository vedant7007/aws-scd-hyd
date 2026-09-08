import type { Attendee } from '../db/types'
import { mockProvider } from './mock'

export type TicketEventType = 'registered' | 'cancelled' | 'refunded'

export type TicketEvent = {
  type: TicketEventType
  ticketRef: string
  name: string
  email: string
  phone: string
  college: string
  tier: Attendee['tier']
  foodPreference: Attendee['foodPreference']
}

export interface TicketingProvider {
  checkoutUrl(tierId: string): string
  /** Must verify the signature against the raw body BEFORE parsing it. */
  verifyAndParse(req: Request): Promise<TicketEvent | null>
  listAll(): Promise<TicketEvent[]>
}

/**
 * The payment provider is undecided, see SPEC.md section 8. Only the mock
 * exists. konfhub.ts and razorpay.ts are deliberately not written, because a
 * speculative implementation of an API we have not signed up for would rot
 * before anyone ran it.
 *
 * When a provider is chosen, add one file here and one case below. Switching
 * must stay a single env var change. If it is not, the abstraction is wrong.
 */
export function getTicketingProvider(): TicketingProvider {
  const name = process.env.TICKETING_PROVIDER ?? 'mock'

  switch (name) {
    case 'mock':
      return mockProvider
    default:
      throw new Error(
        `TICKETING_PROVIDER is "${name}", which has no implementation. Only "mock" exists today.`,
      )
  }
}
