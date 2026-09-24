export type Tier = 'basic' | 'premium' | 'ultra' | 'vip'
/** Veg and non-veg only, by the organiser's decision. */
export type FoodPreference = 'veg' | 'nonveg'
export type AttendeeSource = 'checkout' | 'reconcile' | 'manual'
export type Track = 'ai' | 'cloud' | 'career'
/** TODO(vedant): unset on every session until decided. Nothing is a workshop by default. */
export type SessionType = 'keynote' | 'talk' | 'qa' | 'workshop' | 'panel'
export type PaymentMode = 'manual' | 'razorpay'
/** Year of study, as the form offers it. Five values, stored as typed. */
export type YearOfStudy = '1' | '2' | '3' | '4' | 'other'
export const YEARS_OF_STUDY: YearOfStudy[] = ['1', '2', '3', '4', 'other']
/** Two roles. An admin does everything; a volunteer runs the gate scanner and nothing else. */
export type CrewRole = 'admin' | 'volunteer'

/**
 * The lifecycle. Amendment 1 section 1. Every transition is a conditional
 * write asserting the current state, so an attempt from any other state
 * fails and changes nothing; that is what stops a double-clicked Verify
 * sending two emails. The legal transitions are in lib/registration/state.ts
 * and nowhere else.
 *
 *   AWAITING_PAYMENT      form submitted, home track chosen, no UTR yet
 *   PENDING_VERIFICATION  UTR and screenshot submitted, nobody has checked
 *   VERIFIED              an admin matched the UTR against the bank statement
 *   SESSIONS_SELECTED     student has picked one session per slot
 *   REJECTED              admin could not find the payment
 *   ABANDONED             AWAITING_PAYMENT that expired without a UTR
 */
export type RegistrationState =
  | 'AWAITING_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'SESSIONS_SELECTED'
  | 'REJECTED'
  | 'ABANDONED'

export const REGISTRATION_STATES: RegistrationState[] = [
  'AWAITING_PAYMENT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'SESSIONS_SELECTED',
  'REJECTED',
  'ABANDONED',
]

/** Every item carries the table keys. GSI1 keys are only on the items that need them. */
type Keyed = {
  PK: string
  SK: string
  GSI1PK?: string
  GSI1SK?: string
}

export type Attendee = Keyed & {
  /**
   * The one identifier. SCD- and ten characters, generated at submission,
   * never regenerated. It is the pass page URL, the QR payload, the UPI note
   * reference, the CSV key and what the gate reads aloud.
   */
  passId: string
  name: string
  /** Always lowercased on write. */
  email: string
  phone: string
  college: string
  tier: Tier
  /** Chosen at registration. Counts against that track's counter. Selection may draw from more, per tracksAllowed. */
  homeTrack: Track
  foodPreference: FoodPreference
  yearOfStudy: YearOfStudy
  /** The 18+ confirmation ticked at registration. Never absent on a record made through the form. */
  over18: boolean
  state: RegistrationState
  paymentMode: PaymentMode
  /**
   * What the record is to be paid, in paise, decided by the server from
   * content and LOCKED here at step one. Never from the client, never
   * recomputed: the admin verifies against this number and no other.
   */
  amountPaise: number
  /** True when the early bird discount was claimed at step one and amountPaise carries it. */
  earlyBird?: boolean
  /** The full price, kept beside a discounted amountPaise so a reinstate can fall back to it. */
  listPricePaise?: number
  /** The 50th early bird place went a moment before this record was made; it was charged full price and told so. */
  earlyBirdMissed?: boolean
  /** Razorpay only. */
  orderId?: string
  /** The provider payment that settled it, or UTR:<utr> for a manual payment. Written by the verify transition. */
  paymentId?: string
  paidAt?: string
  /** Manual payments. The 12 digit UTR the student typed. Unique across the table through a UTR# item. */
  utr?: string
  utrSubmittedAt?: string
  /** S3 key of the UPI screenshot in the private bucket. Only ever read through a presigned URL minted for an admin. */
  screenshotKey?: string
  /** Why the last UTR was rejected. Cleared when a corrected one is submitted. */
  rejectionReason?: string
  /** Admin email and time of the last verify, reject or reinstate. The VERIFY# log items hold the full trail. */
  verifiedBy?: string
  verifiedAt?: string
  /** While AWAITING_PAYMENT: when the sweep may move it to ABANDONED. ISO. Cleared on the UTR. */
  holdUntil?: string
  sessionsSelectedAt?: string
  /** Email 1, sent on PENDING_VERIFICATION. */
  receiptSentAt?: string
  /** Email 2, sent on VERIFIED. Absent means owed; reconcile retries. */
  confirmationSentAt?: string
  /** Email 3, sent by the session release run. Its idempotency key. */
  sessionsReleaseEmailSentAt?: string
  /** Email 4, sent on SESSIONS_SELECTED. */
  passReadySentAt?: string
  checkedInAt?: string
  swagIssuedAt?: string
  source: AttendeeSource
  createdAt: string
}

/**
 * One held seat: this attendee, this session. Four per attendee, one per
 * slot, written in the same transaction as the session's seatsTaken
 * increment and deleted in the same transaction as the decrement.
 */
export type Seat = Keyed & {
  passId: string
  sessionId: string
  slotId: string
  track: Track
  createdAt: string
}

/**
 * One of the 12 sessions, "<slot>-<track>". The structure comes from content
 * and is written by the seed; seatsTaken is the only field the site changes.
 *
 * physicalCapacity is the room's real seat count, null while the track has no
 * room. sellableCapacity is how many of those selection may claim, null
 * until decided. The claim condition is seatsTaken < sellableCapacity, so a
 * null sellable refuses every claim and never falls back to physical.
 */
export type Session = Keyed & {
  sessionId: string
  slotId: string
  track: Track
  roomId: string | null
  title: string | null
  speaker: string | null
  type: SessionType | null
  physicalCapacity: number | null
  sellableCapacity: number | null
  seatsTaken: number
}

/**
 * Amendment 1 section 2. How many registrations count against a track's
 * room, incremented conditionally at step one of registration so nobody
 * reaches the payment screen for a track that cannot seat them, decremented
 * only when a record is abandoned. The ceiling is the sellable capacity of
 * the track's room, null while that is undecided, which refuses every
 * registration for the track.
 */
export type TrackCounter = Keyed & {
  track: Track
  registered: number
  ceiling: number | null
}

/**
 * The early bird pool, one item, same pattern as the track counter. claimed
 * is incremented conditionally in the step one transaction and decremented
 * in the abandon transaction, so the discount can never be given more than
 * ceiling times.
 */
export type EarlyBirdCounter = Keyed & { claimed: number; ceiling: number }

/** One crew account. Role decides what the server will serve them. */
export type CrewUser = Keyed & {
  email: string
  role: CrewRole
  addedBy: string
  addedAt: string
}

/** Race-safe admin count, so two admins cannot demote each other into zero. */
export type UsersMeta = Keyed & { admins: number }

/** Every change to a crew account or a setting, who, to whom, when. Append only. */
export type CrewAudit = Keyed & {
  action: 'add' | 'role' | 'remove' | 'bootstrap' | 'registration-open' | 'registration-close' | 'track-room'
  by: string
  target: string
  role?: CrewRole
  detail?: string
  at: string
}

export type Room = {
  id: string
  name: string
  physicalCapacity: number
  /** A buffer room is never a session venue and never appears in a grid or picker. */
  role: 'track' | 'buffer'
}
/** Times are null until decided; every surface prints the label alone then. */
export type Slot = { id: string; label: string; startsAt: string | null; endsAt: string | null }

export type EventConfig = Keyed & {
  rooms: Room[]
  slots: Slot[]
  roomForTrack: Partial<Record<Track, string>>
  /** The switch. Flipped by an admin from the settings page; enforced in the step one route. */
  registrationOpen: boolean
  registrationOpenChangedAt?: string
  registrationOpenChangedBy?: string
  /** Set by the admin release action. Gates the picker and triggers email 3. */
  sessionsReleased: boolean
  sessionsReleasedAt?: string
}

/**
 * A used UTR. Put with a condition that it does not exist (or already belongs
 * to this pass), in the same transaction as the attendee update, so the table
 * itself refuses a second submission of the same UTR anywhere in the system.
 */
export type UtrClaim = Keyed & { utr: string; passId: string; submittedAt: string }

/** One admin action on a registration. Append only. */
export type VerificationLog = Keyed & {
  passId: string
  action: 'verify' | 'reject' | 'reinstate' | 'change-selection'
  utr?: string
  by: string
  at: string
  reason?: string
  detail?: string
}

export type Subscriber = Keyed & {
  email: string
  createdAt: string
  /** Which passes they said they were eyeing. Only the notify form sets it. */
  interestedPasses?: string[]
  /** 'register-closed' from the notify page, absent from the older form. */
  source?: string
}

/** Projection of a Session sent to the browser so the picker can show live seats. */
export type SeatCount = {
  sessionId: string
  seatsTaken: number
  sellableCapacity: number | null
}

/** Points a provider order at the record it pays for. Written with the record. Razorpay only. */
export type OrderPointer = Keyed & { orderId: string; passId: string }

/** Summary of the most recent scheduled run, SPEC.md section 8. */
export type ReconcileSummary = Keyed & {
  ranAt: string
  provider: string
  /** Settled payments the provider reported for the window. Razorpay mode. */
  checked: number
  inserted: number
  deactivated: number
  /** Emails sent on this run. */
  emailed: number
  mismatches: number
  /** AWAITING_PAYMENT records whose hold lapsed on this run, moved to ABANDONED. */
  abandoned?: number
  ok: boolean
  error?: string
}

export type EmailEventType = 'bounce' | 'complaint'

/**
 * One bounce or complaint, as delivered by SES through SNS. Kept per address
 * under EMAIL#<address>, and listed by type through GSI1 for the dashboard.
 */
export type EmailEvent = Keyed & {
  type: EmailEventType
  /** Permanent or Transient for bounces, the feedback type for complaints. */
  subType: string
  address: string
  messageId: string
  feedbackId: string
  occurredAt: string
  recordedAt: string
  /** True when the address was added to the SES suppression list as a result. */
  suppressed: boolean
  /** Why suppression was not attempted, when it was not. */
  note?: string
}
