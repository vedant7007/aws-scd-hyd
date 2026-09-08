import { defineFunction } from '@aws-amplify/backend'

/**
 * SPEC.md section 8. Reconciliation is not optional: without it, one webhook
 * that failed silently means a student arrives on 30 October holding a valid
 * ticket we have no record of.
 *
 * Hourly, so the worst case gap between a lost webhook and a repaired record is
 * an hour rather than the whole run up to the event.
 */
export const reconcile = defineFunction({
  name: 'reconcile',
  entry: './handler.ts',
  schedule: 'every 1h',
  timeoutSeconds: 300,
  memoryMB: 512,
})
