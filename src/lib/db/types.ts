export type Tier = 'basic' | 'premium' | 'ultra' | 'vip'
export type FoodPreference = 'veg' | 'nonveg' | 'jain'
/**
 * pending: a record written at registration, before any money moved. It has
 * no passToken, so nothing can open a pass for it, and every consumer already
 * filters on paid, so it is invisible at the gate and to the caterer. It does
 * hold seats, which is the point: the seat is claimed when the record is
 * created, not when the money is verified, so two people cannot pay for the
 * last one. Only settle() moves it to paid, on a verified payment event or an
 * admin confirming a UTR.
 *
 * expired: pending, and its hold ran out with no UTR. Its seats are released
 * and the record is kept as evidence.
 */
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'cancelled' | 'expired'
export type AttendeeSource = 'checkout' | 'reconcile' | 'manual'
export type Track = 'ai' | 'cloud' | 'career'
/** TODO(vedant): unset on every session until decided. Nothing is a workshop by default. */
export type SessionType = 'keynote' | 'talk' | 'qa' | 'workshop' | 'panel'
/** Where a manual (UTR) payment stands. Absent on a Razorpay record. */
export type VerificationStatus = 'awaiting' | 'confirmed' | 'rejected'
export type PaymentMode = 'manual' | 'razorpay'

/** Every item carries the table keys. GSI1 keys are only on the items that need them. */
type Keyed = {
  PK: string
  SK: string
  GSI1PK?: string
  GSI1SK?: string
}

export type Attendee = Keyed & {
  ticketRef: string
  /** Minted when paid, never before. Absent on a pending record by design. */
  passToken?: string
  name: string
  /** Always lowercased on write. */
  email: string
  phone: string
  college: string
  tier: Tier
  /** Distinct tracks chosen at registration, at most the tier's tracksAllowed. A seat is held in every session of each. */
  tracks: Track[]
  foodPreference: FoodPreference
  paymentStatus: PaymentStatus
  /** Which payment mode created it, so a record is always read the way it was written. */
  paymentMode?: PaymentMode
  /** The provider order this record was created to pay for. Razorpay only. */
  orderId?: string
  /** What the record is to be paid, in paise, decided by the server. Never from the client. */
  amountPaise?: number
  /** Bearer for the browser that started this registration to poll its status and submit a UTR. */
  checkoutToken?: string
  /** The provider payment that settled it, or UTR:<utr> for a manual payment. Written once by settle. */
  paymentId?: string
  paidAt?: string
  /** Manual payments. The 12 digit UTR the student typed. Unique across the table through a UTR# item. */
  utr?: string
  utrSubmittedAt?: string
  verification?: VerificationStatus
  /** Why the last UTR was rejected. Cleared when a corrected one is submitted. */
  rejectionReason?: string
  /** Admin email and time of the confirm or reject. The log items hold the full trail. */
  verifiedBy?: string
  verifiedAt?: string
  /** While pending with no UTR: when the hold lapses and the seats go back. ISO. */
  holdUntil?: string
  checkedInAt?: string
  swagIssuedAt?: string
  /** Set once the confirmation email is accepted by SES. Absent means owed. */
  confirmationSentAt?: string
  source: AttendeeSource
  createdAt: string
}

/**
 * One held seat: this attendee, this session. Written in the same transaction
 * as the session's seatsTaken increment and deleted in the same transaction as
 * the decrement. Keyed by session, not slot, because a tier with more than one
 * track holds a seat in every one of its tracks' sessions in a slot until it
 * refines.
 */
export type Seat = Keyed & {
  ticketRef: string
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
 * room. sellableCapacity is how many of those registration may claim, null
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
  registrationOpen: boolean
  sessionRefinementOpen: boolean
  /** Overrides content/payment.ts so the wording can be changed without a deploy. */
  verificationNote?: string
}

/**
 * A used UTR. Put with a condition that it does not exist, in the same
 * transaction as the attendee update, so the table itself refuses a second
 * submission of the same UTR anywhere in the system.
 */
export type UtrClaim = Keyed & { utr: string; ticketRef: string; submittedAt: string }

/** One admin action on a manual payment. Append only. */
export type VerificationLog = Keyed & {
  ticketRef: string
  action: 'confirm' | 'reject'
  utr: string
  by: string
  at: string
  reason?: string
}

export type Subscriber = Keyed & {
  email: string
  createdAt: string
}

/** Projection of a Session sent to the browser so a picker can show live seats. */
export type SeatCount = {
  sessionId: string
  seatsTaken: number
  sellableCapacity: number | null
}

/** An attendee that has paid. The token is guaranteed, so it can go in an email. */
export type PaidAttendee = Attendee & { passToken: string; paymentStatus: 'paid' }

/** Points a provider order at the record it pays for. Written with the record. */
export type OrderPointer = Keyed & { orderId: string; ticketRef: string }

/** Summary of the most recent reconciliation run, SPEC.md section 8. */
export type ReconcileSummary = Keyed & {
  ranAt: string
  provider: string
  /** Settled payments the provider reported for the window. */
  checked: number
  /** Of those, the ones we had still marked pending: a lost webhook, now applied. */
  inserted: number
  deactivated: number
  /** Confirmations sent on this run, whether for inserts or for earlier failures. */
  emailed: number
  mismatches: number
  /** Manual mode: pending records whose hold lapsed on this run, seats released. */
  expired?: number
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
