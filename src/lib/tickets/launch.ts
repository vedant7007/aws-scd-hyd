import { registrationOpen } from '../../content/event'
import { passes } from '../../content/passes'

/**
 * The guard between test configuration and real customers.
 *
 * registrationOpen is a content flag. On its own it is one edit away from
 * selling one rupee passes through test keys, so it is not allowed to be the
 * only thing that opens the till. Selling is refused while any of these hold:
 *
 *   1. the Razorpay key is a test key
 *   2. any tier on sale has no price, so the placeholder amount would apply
 *   3. RAZORPAY_TEST_AMOUNT_PAISE is set at all
 *
 * The blockers are computed everywhere and shown on the dashboard everywhere.
 * They are enforced in production, which is what next start and Amplify run.
 * Development is exempt so the flow can be exercised against test mode at all;
 * NODE_ENV is set by the runtime, not by configuration, so nothing in an env
 * file can lift the guard on a deployed server.
 */

export type LaunchBlocker = {
  code: 'test-key' | 'unpriced-tier' | 'test-amount-set'
  /** A sentence for the dashboard. Never includes the key or any secret. */
  detail: string
}

export type LaunchInput = {
  keyId: string | undefined
  tiers: { id: string; pricePaise: number | null }[]
  testAmount: string | undefined
}

/** Pure, so each condition can be checked on its own. */
export function launchBlockers(input: LaunchInput): LaunchBlocker[] {
  const out: LaunchBlocker[] = []

  if (!input.keyId) {
    out.push({ code: 'test-key', detail: 'RAZORPAY_KEY_ID is not set, so no order can be created.' })
  } else if (!input.keyId.startsWith('rzp_live_')) {
    out.push({ code: 'test-key', detail: `RAZORPAY_KEY_ID is a ${input.keyId.startsWith('rzp_test_') ? 'test' : 'non-live'} key. Live keys start with rzp_live_.` })
  }

  const unpriced = input.tiers.filter((t) => t.pricePaise === null).map((t) => t.id)
  if (unpriced.length) {
    out.push({
      code: 'unpriced-tier',
      detail: `${unpriced.length === 1 ? 'A tier has' : 'Tiers have'} no price in content/passes.ts: ${unpriced.join(', ')}. The one rupee placeholder would apply.`,
    })
  }

  if (input.testAmount !== undefined) {
    out.push({
      code: 'test-amount-set',
      detail: `RAZORPAY_TEST_AMOUNT_PAISE is set (${input.testAmount || 'empty'}). It must be absent, not merely unused.`,
    })
  }

  return out
}

export const fromEnvironment = (): LaunchInput => ({
  keyId: process.env.RAZORPAY_KEY_ID,
  tiers: passes.map((p) => ({ id: p.id, pricePaise: p.pricePaise })),
  testAmount: process.env.RAZORPAY_TEST_AMOUNT_PAISE,
})

export type LaunchStatus = {
  /** The content flag, as written. */
  registrationOpen: boolean
  blockers: LaunchBlocker[]
  /** Whether blockers are refusing checkouts here. False only in development. */
  enforced: boolean
  /** registrationOpen, and nothing enforced is blocking. What the site acts on. */
  open: boolean
}

export function launchStatus(): LaunchStatus {
  const blockers = launchBlockers(fromEnvironment())
  const enforced = process.env.NODE_ENV === 'production'
  return {
    registrationOpen,
    blockers,
    enforced,
    open: registrationOpen && !(enforced && blockers.length > 0),
  }
}

/** The one question every entry point asks. Never read registrationOpen directly for this. */
export const registrationIsOpen = () => launchStatus().open
