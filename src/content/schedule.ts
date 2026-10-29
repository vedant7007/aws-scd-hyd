/**
 * The day's running order, from VJIT's "Official Agenda" PDF (shared by the
 * organiser on the morning of 30 October 2026). Times are IST, 24 hour, so the
 * schedule page can tell which slot is on now. Spelling fixed from the PDF
 * (First, Manager, Lloyds); nothing else changed.
 */
export type SlotKind = 'gate' | 'ceremony' | 'talk' | 'break' | 'workshop' | 'panel' | 'fun'

export type Slot = {
  start: string
  end: string
  title: string
  kind: SlotKind
  venue: string | null
  people: { name: string; role: string }[]
  /** Who it is for, when not everyone. */
  note?: string
}

/** The agenda named N-Block 203 for both workshops; the organiser held the rooms back (30 October 2026). */
export const VENUE_TBA = 'Venue to be announced'

/** Said wherever the schedule is shown. */
export const SCHEDULE_CAVEAT = 'Timings and venues may change on the day. Volunteers at the venue will guide you.'

export const SCHEDULE: Slot[] = [
  { start: '08:30', end: '09:45', title: 'Check-in and registration', kind: 'gate', venue: 'E-Block', people: [], note: 'Show your ticket QR at the gate' },
  {
    start: '09:45', end: '10:45', title: 'Inauguration ceremony', kind: 'ceremony', venue: 'E-Block Auditorium',
    people: [
      { name: 'Prasanna Galla', role: 'Director, Wipro' },
      { name: 'Narane Gundabathula', role: 'Director, People Operations, Storable India' },
      { name: 'Pavan Kumar Allu', role: 'Technology Head, TCS' },
    ],
  },
  { start: '10:45', end: '11:15', title: 'Cloud 101: Your Journey into AWS', kind: 'talk', venue: 'E-Block Auditorium', people: [{ name: 'Varsha Verma', role: 'AWS Community Builder' }] },
  { start: '11:15', end: '11:25', title: 'Break', kind: 'break', venue: 'E-Block', people: [] },
  { start: '11:25', end: '11:55', title: 'Building on AWS: From Architecture to Deployment', kind: 'talk', venue: 'E-Block Auditorium', people: [{ name: 'Naveen Kumar Kalapala', role: 'Infrastructure Consultant, Infosys' }] },
  { start: '11:55', end: '12:15', title: 'From LLMs to AI Agents: Building the Next Generation of AI', kind: 'talk', venue: 'E-Block Auditorium', people: [{ name: 'Dr. Madhu Oruganti', role: 'AWS ML Engineer' }] },
  { start: '12:15', end: '12:35', title: 'Mastering AWS and DevOps', kind: 'talk', venue: 'E-Block Auditorium', people: [{ name: 'Tirupathi Kumar Chandra', role: 'Senior Engineering Manager, Lloyds Banking' }] },
  { start: '12:35', end: '13:35', title: 'Lunch', kind: 'break', venue: 'Beside E-Block', people: [] },
  {
    start: '13:35', end: '14:20', title: 'Build & Deploy: Your First Application on AWS', kind: 'workshop', venue: VENUE_TBA,
    people: [{ name: 'Avinash Reddy Thipparthi', role: 'Founder and Lead Cloud Educator, Aviz Academy' }],
    note: 'Hands-on: Premium, Platinum and VIP. Bring your laptop',
  },
  {
    start: '14:20', end: '15:00', title: 'Build Your First AI Application', kind: 'workshop', venue: VENUE_TBA,
    people: [{ name: 'Srikar Kokkula', role: 'Associate Engineer, Virtusa' }],
    note: 'Hands-on: Premium, Platinum and VIP. Bring your laptop',
  },
  {
    start: '15:00', end: '15:30', title: 'Panel discussion', kind: 'panel', venue: 'E-Block Auditorium',
    people: [
      { name: 'Ritish Venkat Jogi', role: 'Leader, Microsoft AI Innovators Hub' },
      { name: 'Prof A Ramakrishna Prasad', role: 'Chairman, CSI Hyderabad' },
      { name: 'Hari Pavan', role: 'Manager, HR & TA, Anarock GCV' },
      { name: 'Deepak Kumar Sahu', role: 'Sr. Manager Engineering, Storable India' },
      { name: 'Pushkar Prasad', role: 'Senior VP, DBS Bank' },
    ],
  },
  { start: '15:30', end: '15:50', title: 'Speaker networking', kind: 'ceremony', venue: 'E-Block Board Room', people: [] },
  { start: '15:50', end: '16:00', title: 'Snacks break', kind: 'break', venue: null, people: [] },
  { start: '16:00', end: '16:30', title: 'Entertainment and games', kind: 'fun', venue: 'C-Block Lawn', people: [] },
  { start: '16:30', end: '16:35', title: 'Closing note', kind: 'ceremony', venue: 'C-Block Lawn', people: [] },
]

/** Runs alongside the afternoon, not in the timeline. */
export const ALONGSIDE = { start: '13:35', end: '16:45', title: 'Project Expo', venue: 'E-Block' }

/** "13:35" as "1:35 pm". */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** The workshop's slot, by the stored workshop id, for the email. */
export const WORKSHOP_SLOT: Record<string, Slot | undefined> = {
  w1: SCHEDULE.find((s) => s.title.startsWith('Build & Deploy')),
  w2: SCHEDULE.find((s) => s.title.startsWith('Build Your First AI')),
}
