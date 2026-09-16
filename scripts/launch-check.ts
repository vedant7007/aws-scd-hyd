import assert from 'node:assert/strict'
import { fromEnvironment, launchBlockers, type LaunchInput } from '../src/lib/tickets/launch'

/**
 * The launch guard, one condition at a time. Each case flips exactly one
 * thing away from a clean configuration and must produce exactly that one
 * blocker; the clean configuration must produce none. Pure function, so this
 * needs no environment and no network. `npm run check:launch`.
 */

const clean: LaunchInput = {
  keyId: 'rzp_live_abcdefghijklmn',
  tiers: [
    { id: 'basic', pricePaise: 29900 },
    { id: 'premium', pricePaise: 49900 },
  ],
  testAmount: undefined,
}

const codes = (input: LaunchInput) => launchBlockers(input).map((b) => b.code)

assert.deepEqual(codes(clean), [], 'a clean configuration has no blockers')

assert.deepEqual(codes({ ...clean, keyId: 'rzp_test_abcdefghijklmn' }), ['test-key'], 'a test key blocks on its own')
assert.deepEqual(codes({ ...clean, keyId: undefined }), ['test-key'], 'no key blocks on its own')
assert.deepEqual(codes({ ...clean, keyId: 'something_else' }), ['test-key'], 'a malformed key blocks on its own')

assert.deepEqual(
  codes({ ...clean, tiers: [clean.tiers[0]!, { id: 'premium', pricePaise: null }] }),
  ['unpriced-tier'],
  'one unpriced tier blocks on its own',
)
assert.deepEqual(codes({ ...clean, tiers: [] }), [], 'no tiers on sale means nothing is unpriced')

assert.deepEqual(codes({ ...clean, testAmount: '100' }), ['test-amount-set'], 'RAZORPAY_TEST_AMOUNT_PAISE=100 blocks on its own')
assert.deepEqual(codes({ ...clean, testAmount: '' }), ['test-amount-set'], 'an empty RAZORPAY_TEST_AMOUNT_PAISE still counts as set')

assert.deepEqual(
  codes({ keyId: 'rzp_test_x', tiers: [{ id: 'basic', pricePaise: null }], testAmount: '100' }),
  ['test-key', 'unpriced-tier', 'test-amount-set'],
  'all three report together',
)

for (const b of launchBlockers({ ...clean, keyId: 'rzp_test_SECRETSECRET' })) {
  assert.ok(!b.detail.includes('SECRETSECRET'), 'a blocker never echoes the key')
}

console.log('launch guard: 10 assertions passed')

// And the real configuration this process sees, for the record.
const here = launchBlockers(fromEnvironment())
console.log(`this environment: ${here.length ? here.map((b) => b.code).join(', ') : 'no blockers'}`)
