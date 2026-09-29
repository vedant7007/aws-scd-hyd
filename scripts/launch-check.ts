import assert from 'node:assert/strict'
import { fromEnvironment, launchBlockers, type LaunchInput } from '../src/lib/tickets/launch'

/**
 * The launch guard, one condition at a time. Each case flips exactly one
 * thing away from a clean configuration and must produce exactly that one
 * blocker; the clean configuration must produce none. Pure function, so this
 * needs no environment and no network. `npm run check:launch`.
 */

const clean: LaunchInput = {
  tiers: [
    { id: 'basic', pricePaise: 39900 },
    { id: 'premium', pricePaise: 79900 },
  ],
  upiId: 'college@bank',
  screenshots: true,
  verificationWindow: '24 hours',
  adminEmails: ['a@example.test'],
}

const codes = (input: LaunchInput) => launchBlockers(input).map((b) => b.code)

assert.deepEqual(codes(clean), [], 'a clean configuration has no blockers')
assert.deepEqual(codes({ ...clean, tiers: [clean.tiers[0]!, { id: 'premium', pricePaise: null }] }), ['unpriced-tier'], 'one unpriced tier blocks on its own')
assert.deepEqual(codes({ ...clean, upiId: null }), ['upi-id-unset'], 'no UPI id blocks')
assert.deepEqual(codes({ ...clean, screenshots: false }), ['screenshots-unset'], 'no screenshot bucket blocks')
assert.deepEqual(codes({ ...clean, verificationWindow: '  ' }), ['verification-window-unset'], 'empty wording blocks')
assert.deepEqual(codes({ ...clean, adminEmails: [] }), ['no-admin'], 'no admin blocks')
assert.deepEqual(
  codes({ tiers: [{ id: 'basic', pricePaise: null }], upiId: null, screenshots: false, verificationWindow: '', adminEmails: [] }),
  ['unpriced-tier', 'upi-id-unset', 'screenshots-unset', 'verification-window-unset', 'no-admin'],
  'every blocker reports together',
)

console.log('launch guard: 7 assertions passed')
fromEnvironment().then((here) => console.log(`this environment: ${codes(here).join(', ') || 'no blockers'}`))
