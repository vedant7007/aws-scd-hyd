import { defineFunction } from '@aws-amplify/backend'

/**
 * Receives bounce and complaint notifications from SES through SNS, records
 * each one, and adds the address to the SES suppression list. This is the
 * process we told AWS Support we have, so it has to exist and it has to run.
 */
export const emailEvents = defineFunction({
  name: 'email-events',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
})
