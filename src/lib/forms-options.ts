/**
 * The choices on the Speak, Sponsor and report forms, as the handoff lists
 * them. Plain data with no server imports, so the forms in the browser and
 * the checks on the server read the same lists.
 */
export const SPEAK_FORMATS = [
  { id: 'keynote', label: 'KEYNOTE', note: 'Opens the day, whole room' },
  { id: 'session', label: 'SESSION', note: '60 min talk plus Q and A' },
  { id: 'workshop', label: 'WORKSHOP', note: 'Hands-on, laptops open' },
  { id: 'panel', label: 'PANEL', note: 'You are happy to join others' },
] as const
export const SPONSOR_KINDS = [
  { id: 'food', label: 'FOOD' },
  { id: 'event', label: 'EVENT' },
  { id: 'swag', label: 'SWAG KITS' },
  { id: 'stall', label: 'STALL' },
  { id: 'other', label: 'SOMETHING ELSE' },
] as const
export const REPORT_KINDS = [
  { id: 'conduct', label: 'CONDUCT' },
  { id: 'registration', label: 'REGISTRATION' },
  { id: 'payment', label: 'PAYMENT' },
  { id: 'other', label: 'SOMETHING ELSE' },
] as const
