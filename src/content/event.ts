import type { Room, SessionType, Slot, Track } from '../lib/db/types'

export const event = {
  name: 'AWS Student Community Day Hyderabad',
  shortName: 'AWS SCD Hyderabad',
  city: 'Hyderabad',
  /** Doors, confirmed 09:30 IST. What the landing page counts down to. */
  startsAt: '2026-10-30T09:30:00+05:30',
  dateLabel: 'Friday 30 October 2026',
  host: 'AWS Student Builders Group, VJIT',
  // Public contact. Deliberately the Gmail address, not the domain: awsscdhyd.in
  // is send only and has no mailbox, so a domain address here would lose replies.
  contactEmail: 'awssbgvjit@gmail.com',
  /** Required on every page footer, wording is fixed. */
  disclaimer: 'AWS User Groups are run by independent volunteers and are not organized by AWS.',
} as const

/** Doors as the landing page prints it, "09:30". Derived from startsAt, never typed twice. */
export const doorsLabel = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Kolkata',
}).format(new Date(event.startsAt))

export const venue: {
  name: string
  address: string
  directionsUrl: string
} = {
  name: 'Vidya Jyothi Institute of Technology',
  address:
    'Vidya Jyothi Institute of Technology, Aziznagar Village Road, Aziznagar, Hyderabad, Telangana 500075',
  /**
   * The authoritative pin, supplied by Vedant. Deliberately not a name search,
   * which can resolve to a different campus and send people to the wrong gate.
   */
  directionsUrl: 'https://maps.app.goo.gl/PAPnu2YHVdWE2pvQ6',
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
 * The four rooms VJIT has given us, with their real physical seat counts.
 * Three host a track each. The fourth is a buffer: overflow, a broken
 * projector, a speaker who needs a quiet room. It is never a session venue,
 * so it never appears in the schedule or the picker, and nothing counts its
 * seats.
 *
 * TODO(vedant): which of the four is the buffer is assumed to be the last one
 * listed. Move the role if that is wrong.
 */
export const rooms: Room[] = [
  { id: 'e-aud', name: 'E Block auditorium', physicalCapacity: 240, role: 'track' },
  { id: 'c-g', name: 'C Block ground floor', physicalCapacity: 400, role: 'track' },
  { id: 'c-1', name: 'C Block first floor', physicalCapacity: 100, role: 'track' },
  { id: 'c-2', name: 'C Block second floor', physicalCapacity: 100, role: 'buffer' },
]

/**
 * Seats held back from sale in EVERY room, for speakers, sponsors,
 * organisers, VIP flex and no-shows. Fifteen, by the organiser's decision.
 * A session's sellable capacity is its room's physical count minus this
 * unless sessionDetails says otherwise.
 */
export const ROOM_RESERVE = 15

/**
 * PROVISIONAL. Which track runs in which room. The organiser has not
 * decided, and registration opens anyway, so these stand until they do:
 *
 *   AI and Agents  ->  C-block ground floor, 400 seats, sells 385
 *   Cloud          ->  E-block auditorium,   240 seats, sells 225
 *   Career         ->  C-block first floor,  100 seats, sells  85
 *
 * The room may change; the ceiling may only be raised. Once people have
 * registered against a track, moving it to a smaller room would oversell
 * it, which is not recoverable on the day, so the admin action that changes
 * a room refuses any ceiling below the track's registered count.
 */
export const roomForTrack: Partial<Record<Track, string>> = {
  ai: 'c-g',
  cloud: 'e-aud',
  career: 'c-1',
}

/**
 * Four slots. 3 tracks x 4 slots = 12 sessions. TODO(vedant): times are
 * undecided, so startsAt and endsAt are null and every surface prints the
 * label alone until they are set.
 */
export const slots: Slot[] = [
  { id: 's1', label: 'Slot 1', startsAt: null, endsAt: null },
  { id: 's2', label: 'Slot 2', startsAt: null, endsAt: null },
  { id: 's3', label: 'Slot 3', startsAt: null, endsAt: null },
  { id: 's4', label: 'Slot 4', startsAt: null, endsAt: null },
]

/**
 * Per session detail, keyed by session id, which is "<slot>-<track>". Every
 * field is TODO(vedant) and absent until decided. Titles and speakers arrive
 * with the line-up. The type is never assumed: nothing is a workshop until
 * it is written here. sellableCapacity is how many of the room's physical
 * seats registration may claim; unset, it is the room's count minus
 * ROOM_RESERVE, and it is capped at the physical count either way. A session
 * whose track has no room has no capacity and refuses every claim.
 */
export type SessionDetail = {
  title?: string
  speaker?: string
  type?: SessionType
  sellableCapacity?: number
}
export const sessionDetails: Partial<Record<string, SessionDetail>> = {}

/**
 * Amendment 1 section 4. Whether students may choose their sessions yet.
 * Flipped by the admin release action (which also sends email 3) and stored
 * on the config item; this is only the default before that has ever run.
 */
export const sessionsReleased: boolean = false

/**
 * THE MASTER SWITCH. While this is false nothing sells, whatever the config
 * item says and whatever an admin clicks: the public pages show the notify
 * page instead of a form, and step one of the parked flow refuses. Flip it
 * to true only when the new registration flow is decided and built.
 */
export const REGISTRATION_OPEN = false

/**
 * The admin switch on the settings page, stored on the config item. It can
 * only ever close registration further, never past REGISTRATION_OPEN above.
 * This is the default for a config item that has never been written.
 */
export const registrationOpen: boolean = true

export const about = [
  'A one day community conference put on by students, for students, in Hyderabad.',
  'A keynote to open, technical sessions on Cloud Engineering and AI, hands-on workshops, a panel and an open Q and A. Your pass decides which of these you get.',
  'It is run by volunteers from the AWS Student Builders Group at VJIT, and it is not an AWS event.',
]
