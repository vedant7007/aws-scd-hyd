import { createHmac, timingSafeEqual } from 'node:crypto'
import type { TicketEvent, TicketEventType, TicketingProvider } from './provider'

/** Type only import above, so there is no runtime cycle with provider.ts. */

export const SIGNATURE_HEADER = 'x-scd-signature'

const TYPES: TicketEventType[] = ['registered', 'cancelled', 'refunded']
const TIERS = ['basic', 'premium', 'ultra', 'vip']
const FOODS = ['veg', 'nonveg', 'jain']

/** Exported so tests and the mock sender agree on one scheme. */
export function sign(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`
}

/**
 * Constant time compare. Returns false rather than throwing on a length
 * mismatch, because timingSafeEqual requires equal lengths.
 */
function signatureMatches(rawBody: string, provided: string | null): boolean {
  const secret = process.env.TICKETING_WEBHOOK_SECRET
  if (!secret || !provided) return false

  const expected = Buffer.from(sign(rawBody, secret))
  const actual = Buffer.from(provided)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/** Strict. An unrecognised payload is rejected rather than half accepted. */
function toTicketEvent(payload: unknown): TicketEvent | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>

  if (!isString(p.type) || !TYPES.includes(p.type as TicketEventType)) return null
  if (!isString(p.ticketRef) || !isString(p.name) || !isString(p.email)) return null
  if (!isString(p.tier) || !TIERS.includes(p.tier)) return null
  if (!isString(p.foodPreference) || !FOODS.includes(p.foodPreference)) return null

  return {
    type: p.type as TicketEventType,
    ticketRef: p.ticketRef,
    name: p.name,
    email: p.email,
    phone: isString(p.phone) ? p.phone : '',
    college: isString(p.college) ? p.college : '',
    tier: p.tier as TicketEvent['tier'],
    foodPreference: p.foodPreference as TicketEvent['foodPreference'],
  }
}

export const mockProvider: TicketingProvider = {
  /**
   * The mock has no hosted checkout. Registration is closed while
   * content/event.ts sets registrationOpen to false, so nothing renders this
   * yet. It points at the passes section rather than a URL that would 404.
   */
  checkoutUrl(tierId: string): string {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? ''
    return `${site}/#passes?tier=${encodeURIComponent(tierId)}`
  },

  async verifyAndParse(req: Request): Promise<TicketEvent | null> {
    // Read the raw body and verify it BEFORE parsing, per SPEC.md section 7.
    // Nothing about an unverified body is logged, here or by the caller.
    const raw = await req.text()

    if (!signatureMatches(raw, req.headers.get(SIGNATURE_HEADER))) return null

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return null
    }
    return toTicketEvent(payload)
  },

  /**
   * Deterministic stand in for the provider's order list, used by the
   * reconciliation Lambda in phase 3. Fixed rather than random so a
   * reconciliation run is repeatable.
   */
  async listAll(): Promise<TicketEvent[]> {
    return Array.from({ length: 3 }, (_, i) => ({
      type: 'registered' as const,
      ticketRef: `MOCK-${String(i + 1).padStart(3, '0')}`,
      name: `Mock Attendee ${i + 1}`,
      email: `mock.${i + 1}@example.test`,
      phone: '+910000000000',
      college: 'VJIT',
      tier: TIERS[i % TIERS.length] as TicketEvent['tier'],
      foodPreference: FOODS[i % FOODS.length] as TicketEvent['foodPreference'],
    }))
  },
}
