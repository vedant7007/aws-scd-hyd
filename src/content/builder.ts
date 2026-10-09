/**
 * AWS Builder ID. Every attendee gives the @username of their AWS Builder
 * Center profile (shown under Manage profile), organiser's decision,
 * 7 October 2026. Those without one create it through the event's own
 * invite link (changed 9 October 2026 from the earlier bit.ly one).
 */
export const BUILDER_SIGNUP = 'https://builder.aws.com?inviteId=181ad685-385c-4861-8642-0dd6c98fbc26'

/** The public profile behind a username. */
export const builderProfile = (alias: string) => `https://builder.aws.com/community/@${alias}`

/** How to get one, in the words the flow, the page and the email all use. */
export const BUILDER_STEPS = [
  'Open the sign-up link and choose Sign in, then Create AWS Builder ID.',
  'Enter your email and name, type in the code AWS emails you, and set a password.',
  'When it asks, choose your alias. That is your @username.',
  'Already have one? Sign in, click your name at the top right, then Manage profile. Your @username is shown there.',
] as const

/**
 * What a person typed, to the bare username: "@name", "name" or a whole
 * profile link all come back as "name". Null for anything that cannot be one.
 */
export function normaliseBuilderId(raw: string): string | null {
  let v = raw.trim()
  const fromLink = /builder\.aws\.com\/community\/@?([^/?#\s]+)/i.exec(v)
  if (fromLink) v = fromLink[1]!
  v = v.replace(/^@+/, '')
  return /^[A-Za-z0-9._-]{2,50}$/.test(v) ? v : null
}
