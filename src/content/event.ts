import type { Hall, Slot } from '@/lib/db/types'

export const event = {
  name: 'AWS Student Community Day Hyderabad',
  shortName: 'AWS SCD Hyderabad',
  city: 'Hyderabad',
  /** Doors, and what the landing page counts down to. */
  startsAt: '2026-10-30T09:00:00+05:30',
  dateLabel: 'Friday 30 October 2026',
  host: 'AWS Student Builders Group, VJIT',
  // Public contact. Deliberately the Gmail address, not the domain: awsscdhyd.in
  // is send only and has no mailbox, so a domain address here would lose replies.
  contactEmail: 'awssbgvjit@gmail.com',
  /** Required on every page footer, wording is fixed. */
  disclaimer: 'AWS User Groups are run by independent volunteers and are not organized by AWS.',
} as const

export const venue: {
  name: string
  address: string | null
  mapsUrl: string
} = {
  name: 'Vidya Jyothi Institute of Technology',
  /**
   * TODO(vedant): the full postal address was not in the spec. Left null on
   * purpose rather than guessed, because a wrong address on a public event page
   * sends people to the wrong gate. The venue block hides this line until set.
   */
  address: null,
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Vidya+Jyothi+Institute+of+Technology+Hyderabad',
}

/**
 * TODO(vedant): none of these are confirmed. Each stays null until you supply
 * it, and the venue block renders only the ones that are filled in.
 */
export const travel: { label: string; detail: string | null }[] = [
  { label: 'Metro', detail: null },
  { label: 'Bus', detail: null },
  { label: 'Cab', detail: null },
  { label: 'Parking', detail: null },
]

/**
 * TODO(vedant): hall count is 3 or 4 and unconfirmed, names and capacities are
 * placeholders. Nothing may hardcode a hall count. Read config.halls at runtime.
 */
export const halls: Hall[] = [
  { id: 'h1', name: 'Hall 1', capacity: 200 },
  { id: 'h2', name: 'Hall 2', capacity: 150 },
  { id: 'h3', name: 'Hall 3', capacity: 120 },
]

/** TODO(vedant): slot times are placeholders until the schedule is fixed. */
export const slots: Slot[] = [
  { id: 's1', label: 'Session 1', startsAt: '2026-10-30T10:30:00+05:30', endsAt: '2026-10-30T11:15:00+05:30' },
  { id: 's2', label: 'Session 2', startsAt: '2026-10-30T11:30:00+05:30', endsAt: '2026-10-30T12:15:00+05:30' },
  { id: 's3', label: 'Session 3', startsAt: '2026-10-30T14:00:00+05:30', endsAt: '2026-10-30T14:45:00+05:30' },
  { id: 's4', label: 'Session 4', startsAt: '2026-10-30T15:00:00+05:30', endsAt: '2026-10-30T15:45:00+05:30' },
]

/** TODO(vedant): flip when the registration open date is decided. */
export const registrationOpen: boolean = false

export const about = [
  'A one day community conference put on by students, for students, in Hyderabad.',
  'Three tracks run in parallel across the day: AI and agents, cloud engineering, and careers. You pick one session per slot and keep your seat.',
  'It is run by volunteers from the AWS Student Builders Group at VJIT, and it is not an AWS event.',
]
