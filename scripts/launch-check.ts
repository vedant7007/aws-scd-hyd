import assert from 'node:assert/strict'
import { fromEnvironment, launchBlockers, type LaunchInput } from '../src/lib/tickets/launch'

/**
 * The launch guard, one condition at a time, per payment mode. Each case
 * flips exactly one thing away from a clean configuration and must produce
 * exactly that one blocker; the clean configuration must produce none. Pure
 * function, so this needs no environment and no network. `npm run check:launch`.
 */

const manual: LaunchInput = {
  mode: 'manual',
  keyId: undefined,
  tiers: [
    { id: 'basic', pricePaise: 39900 },
    { id: 'premium', pricePaise: 79900 },
  ],
  testAmount: undefined,
  qrAssetPresent: true,
  verificationWindow: '24 hours',
  adminEmails: ['a@example.test'],
  unassignedTracks: [],
  unsetSessions: [],
}
const razorpay: LaunchInput = { ...manual, mode: 'razorpay', keyId: 'rzp_live_abcdefghijklmn', qrAssetPresent: false, adminEmails: [] }

const codes = (input: LaunchInput) => launchBlockers(input).map((b) => b.code)

assert.deepEqual(codes(manual), [], 'a clean manual configuration has no blockers')
assert.deepEqual(codes(razorpay), [], 'a clean razorpay configuration has no blockers')

const firstTier = manual.tiers[0]!
assert.deepEqual(codes({ ...manual, tiers: [firstTier, { id: 'premium', pricePaise: null }] }), ['unpriced-tier'], 'one unpriced tier blocks on its own')
assert.deepEqual(codes({ ...manual, qrAssetPresent: false }), ['qr-asset-missing'], 'a missing QR asset blocks manual mode')
assert.deepEqual(codes({ ...manual, verificationWindow: '  ' }), ['verification-window-unset'], 'empty wording blocks manual mode')
assert.deepEqual(codes({ ...manual, adminEmails: [] }), ['no-admin'], 'no admin blocks manual mode')
assert.deepEqual(codes({ ...manual, unassignedTracks: ['ai'] }), ['rooms-unassigned'], 'an unassigned track blocks')
assert.deepEqual(codes({ ...manual, unsetSessions: ['s1-ai'] }), ['capacity-unset'], 'an unset capacity blocks')
assert.deepEqual(codes({ ...manual, keyId: 'rzp_test_x', testAmount: '100' }), [], 'razorpay conditions do not apply in manual mode')

assert.deepEqual(codes({ ...razorpay, keyId: 'rzp_test_abcdefghijklmn' }), ['test-key'], 'a test key blocks razorpay mode')
assert.deepEqual(codes({ ...razorpay, keyId: undefined }), ['test-key'], 'no key blocks razorpay mode')
assert.deepEqual(codes({ ...razorpay, testAmount: '' }), ['test-amount-set'], 'an empty RAZORPAY_TEST_AMOUNT_PAISE still counts as set')
assert.deepEqual(codes({ ...razorpay, qrAssetPresent: false, adminEmails: [] }), [], 'manual conditions do not apply in razorpay mode')

assert.deepEqual(
  codes({
    ...manual,
    tiers: [{ id: 'basic', pricePaise: null }],
    qrAssetPresent: false,
    verificationWindow: '',
    adminEmails: [],
    unassignedTracks: ['ai'],
    unsetSessions: ['s1-ai'],
  }),
  ['unpriced-tier', 'qr-asset-missing', 'verification-window-unset', 'no-admin', 'rooms-unassigned', 'capacity-unset'],
  'every manual blocker reports together',
)

console.log('launch guard: 14 assertions passed')
fromEnvironment().then((here) => console.log(`this environment (${here.mode} mode): ${codes(here).join(', ') || 'no blockers'}`))
