export type Tier = 'basic' | 'premium' | 'ultra' | 'vip'
/** Veg and non-veg only, by the organiser's decision. */
/** 'preview' marks a record made through the old test link (removed 29 September 2026): real, but never counted. */
export type AttendeeSource = 'checkout' | 'manual' | 'preview'
/** Year of study, as the v3 flow offers it. Stored as typed. */
export type YearOfStudy = '1' | '2' | '3' | '4' | '5+'
/** Two roles. An admin does everything; a volunteer runs the gate scanner and nothing else. */
export type CrewRole = 'admin' | 'volunteer'

/**
 * The lifecycle. Amendment 1 section 1. Every transition is a conditional
 * write asserting the current state, so an attempt from any other state
 * fails and changes nothing; that is what stops a double-clicked Verify
 * sending two emails. The legal transitions are in lib/registration/state.ts
 * and nowhere else.
 *
 *   AWAITING_PAYMENT      reached the payment step; seats held for 90 minutes, no UTR yet
 *   PENDING_VERIFICATION  UTR and screenshot submitted, nobody has checked
 *   VERIFIED              an admin matched the UTR against the bank statement: the ticket
 *   REJECTED              admin could not find the payment
 *   ABANDONED             AWAITING_PAYMENT whose hold lapsed without a UTR; seats given back
 *
 * Sessions are chosen before payment in the v3 flow, so VERIFIED is final.
 */
export type RegistrationState = 'AWAITING_PAYMENT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'ABANDONED'

export const REGISTRATION_STATES: RegistrationState[] = ['AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ABANDONED']

/** Every item carries the table keys. GSI1 keys are only on the items that need them. */
type Keyed = {
  PK: string
  SK: string
  GSI1PK?: string
  GSI1SK?: string
}

export type Attendee = Keyed & {
  /**
   * The one identifier. SCD- and ten characters, generated at the payment
   * step, never regenerated. It is the pass page URL, the QR payload, the UPI
   * note reference, the CSV key and what the gate reads aloud.
   */
  passId: string
  firstName: string
  middleName?: string
  lastName: string
  /** First, middle and last joined, as printed on the ticket. Kept so every reader has one field to show. */
  name: string
  /** Always lowercased on write. */
  email: string
  /** +91 and ten digits. */
  phone: string
  college: string
  branch: string
  /** Uppercased on write. */
  rollNumber: string
  yearOfStudy: YearOfStudy
  /** YYYY-MM-DD. 18 or older on the event day, checked by the server. */
  dateOfBirth: string
  tier: Tier
  /** The technical session chosen at step two. Holds a seat in it while the record is live. */
  technicalSession: string
  /** Premium and above: the workshop chosen at step two. Holds a seat in it while the record is live. */
  workshop?: string
  state: RegistrationState
  /**
   * What the record is to be paid, in paise, decided by the server from
   * content and LOCKED here when the hold is made. Never from the client:
   * the admin verifies against this number and no other.
   */
  amountPaise: number
  /** SHA-256 of the browser's submission key. Only the browser that made the hold may change it. */
  submissionKeyHash: string
  /** UTR:<utr>, written by the verify transition. */
  paymentId?: string
  paidAt?: string
  /** The UTR the student typed: 12 to 40 letters and digits. Unique across the table through a UTR# item. */
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
  /** Email 1, sent on PENDING_VERIFICATION. */
  receiptSentAt?: string
  /** Email 2, the ticket, sent on VERIFIED. Absent means owed; reconcile retries. */
  confirmationSentAt?: string
  checkedInAt?: string
  swagIssuedAt?: string
  source: AttendeeSource
  createdAt: string
}

/**
 * One technical session or workshop, SESSION#<id>. Its title and level live
 * in content/program.ts; the table holds only what changes. seatsTaken is
 * incremented, conditionally on staying under sellableCapacity, in the same
 * transaction that makes or moves a hold, and given back in the same
 * transaction that abandons one. A null sellableCapacity refuses every
 * claim: nothing sells against a room nobody has sized.
 */
export type Session = Keyed & {
  sessionId: string
  sellableCapacity: number | null
  seatsTaken: number
}

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
  action: 'add' | 'role' | 'remove' | 'bootstrap' | 'registration-open' | 'registration-close' | 'session-capacity'
  by: string
  target: string
  role?: CrewRole
  detail?: string
  at: string
}

export type EventConfig = Keyed & {
  /** The switch. Flipped by an admin from the settings page; enforced in the hold route. */
  registrationOpen: boolean
  registrationOpenChangedAt?: string
  registrationOpenChangedBy?: string
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
  action: 'verify' | 'reject' | 'reinstate'
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
  /** When the "registrations are open" mail went. Written right after each send, so a re-run skips them. */
  openMailSentAt?: string
}

/** Summary of the most recent scheduled run, SPEC.md section 8. */
export type ReconcileSummary = Keyed & {
  ranAt: string
  /** Owed ticket emails sent on this run. */
  emailed: number
  /** AWAITING_PAYMENT records whose hold lapsed on this run, moved to ABANDONED with their seats given back. */
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
