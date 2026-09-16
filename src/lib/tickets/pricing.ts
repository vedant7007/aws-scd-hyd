import { passFor } from '../../content/passes'
import type { Tier } from '../db/types'

/**
 * The one place an amount comes from. Route handlers call this and nothing
 * else; a number arriving in a request body is never an amount.
 *
 * TODO(vedant): PLACEHOLDER PRICING. REMOVE BEFORE LAUNCH.
 *
 * Every tier in content/passes.ts still has pricePaise: null, so every order
 * is created for RAZORPAY_TEST_AMOUNT_PAISE, default 100, which is one rupee.
 * That is deliberate so the whole flow can be exercised in test mode. It is
 * also exactly what must not survive to launch: with live keys and this
 * fallback still in place, every pass sells for one rupee.
 *
 * Setting pricePaise on every tier makes the fallback unreachable. Until then
 * the placeholder is shouted on every order and labelled on the form.
 */
const PLACEHOLDER_PAISE = Number(process.env.RAZORPAY_TEST_AMOUNT_PAISE ?? 100)

export type Amount = {
  amountPaise: number
  /** True when the amount is the test placeholder rather than a real price. */
  placeholder: boolean
}

/** For display only. Warns nowhere; the warning belongs to the order, not the page. */
export const placeholderPaise = () => PLACEHOLDER_PAISE

export function amountFor(tier: Tier): Amount {
  const pass = passFor(tier)
  if (!pass) throw new Error(`amountFor: no such tier "${tier}"`)

  if (pass.pricePaise !== null) return { amountPaise: pass.pricePaise, placeholder: false }

  if (!Number.isInteger(PLACEHOLDER_PAISE) || PLACEHOLDER_PAISE < 100) {
    throw new Error('RAZORPAY_TEST_AMOUNT_PAISE must be a whole number of paise, at least 100.')
  }
  console.warn(
    `[pricing] PLACEHOLDER AMOUNT ${PLACEHOLDER_PAISE} paise for tier "${tier}". content/passes.ts has no price for it. REMOVE BEFORE LAUNCH.`,
  )
  return { amountPaise: PLACEHOLDER_PAISE, placeholder: true }
}
