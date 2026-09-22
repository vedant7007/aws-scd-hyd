import { defineAuth } from '@aws-amplify/backend'

/**
 * Organisers only. There is no student login anywhere on this site.
 * Self sign-up is off, accounts are created by an admin from the crew page,
 * and /admin still looks the email up in the table for a role after Cognito
 * authenticates. ADMIN_EMAILS is only a fallback while the table has no admin.
 */
export const auth = defineAuth({
  loginWith: { email: true },
})
