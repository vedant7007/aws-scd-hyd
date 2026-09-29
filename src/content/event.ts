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
 * The rooms VJIT has given us, with their real physical seat counts. Not
 * read by registration: each technical session and workshop is sized on its
 * own from the settings page. Kept here because those four numbers are what
 * an admin sizes the sessions against, and the settings page shows them.
 */
export const rooms: { id: string; name: string; physicalCapacity: number }[] = [
  { id: 'e-aud', name: 'E Block auditorium', physicalCapacity: 240 },
  { id: 'c-g', name: 'C Block ground floor', physicalCapacity: 400 },
  { id: 'c-1', name: 'C Block first floor', physicalCapacity: 100 },
  { id: 'c-2', name: 'C Block second floor', physicalCapacity: 100 },
]

/**
 * Seats to hold back from sale in every room, for speakers, sponsors,
 * organisers and no-shows. Fifteen, by the organiser's decision. The settings
 * page suggests each room's count minus this.
 */
export const ROOM_RESERVE = 15

/**
 * THE MASTER SWITCH. While this is false nothing sells, whatever the config
 * item says and whatever an admin clicks: /register is the notify page and
 * the hold route refuses. Admins can still walk the real flow at
 * /register/preview.
 *
 * Opened on 29 September 2026 at the organiser's request, for testing with
 * a temporary UPI account. Even so, nothing sells in production until the
 * launch guard is clear: the UPI id set on the server and every session
 * given a seat count on /admin/settings. Until then /register stays the
 * notify page.
 */
export const REGISTRATION_OPEN = true

/**
 * The admin switch on the settings page, stored on the config item. It can
 * only ever close registration further, never past REGISTRATION_OPEN above.
 * This is the default for a config item that has never been written.
 */
export const registrationOpen: boolean = true

export const about = [
  'A one day community conference put on by students, for students, in Hyderabad.',
  'A keynote to open, technical sessions on Cloud Engineering and AI, hands-on workshops, a panel and an open Q&A. Your pass decides which of these you get.',
  'It is run by volunteers from the AWS Student Builders Group at VJIT, and it is not an AWS event.',
]
