import { defineFunction } from '@aws-amplify/backend'

/**
 * SPEC.md section 8. The sweep that gives an unpaid hold's seats back, and
 * the retry for any payment-verified mail that failed to send.
 *
 * Every five minutes: the hold is twenty, so an abandoned registration
 * leaves the queue within five minutes of lapsing rather than up to an hour.
 */
export const reconcile = defineFunction({
  name: 'reconcile',
  entry: './handler.ts',
  schedule: 'every 5m',
  timeoutSeconds: 300,
  memoryMB: 512,
})
