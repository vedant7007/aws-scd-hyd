import { passFor } from '../../content/passes'
import type { Tier } from '../db/types'

/**
 * The one place an amount comes from. Route handlers call this and nothing
 * else; a number arriving in a request body is never an amount. A tier with
 * no price in content/passes.ts never sells for a guessed value: this
 * throws, and the launch guard refuses to open registration first.
 */
export type Amount = { amountPaise: number }

export function amountFor(tier: Tier): Amount {
  const pass = passFor(tier)
  if (!pass) throw new Error(`amountFor: no such tier "${tier}"`)
  if (pass.pricePaise === null) throw new Error(`amountFor: tier "${tier}" has no price in content/passes.ts`)
  return { amountPaise: pass.pricePaise }
}
