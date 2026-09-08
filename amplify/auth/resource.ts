import { defineAuth } from '@aws-amplify/backend'

/**
 * Organisers only. There is no student login anywhere on this site.
 * Self sign-up is off, accounts are created by an admin, and /admin still
 * checks the email against ADMIN_EMAILS after Cognito authenticates.
 */
export const auth = defineAuth({
  loginWith: { email: true },
})
