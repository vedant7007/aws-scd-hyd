export type Tier = 'basic' | 'premium' | 'ultra' | 'vip'
export type FoodPreference = 'veg' | 'nonveg' | 'jain'
/**
 * pending: a record written at checkout, before any money moved. It has no
 * passToken, so nothing can open a pass for it, and every consumer already
 * filters on paid, so it is invisible at the gate, in the picker and to the
 * caterer. Only the payment webhook, or the reconcile run, moves it to paid.
 */
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'cancelled'
export type AttendeeSource = 'checkout' | 'reconcile' | 'manual'
export type Track = 'ai' | 'cloud' | 'career'

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
  foodPreference: FoodPreference
  paymentStatus: PaymentStatus
  /** The provider order this record was created to pay for. Set at checkout. */
  orderId?: string
  /** What the order was for, in paise, decided by the server. Never from the client. */
  amountPaise?: number
  /** Bearer for the browser that started this checkout to poll its status. */
  checkoutToken?: string
  /** The provider payment that settled it. Written once by the webhook or reconcile. */
  paymentId?: string
  paidAt?: string
  checkedInAt?: string
  swagIssuedAt?: string
  /** Set once the confirmation email is accepted by SES. Absent means owed. */
  confirmationSentAt?: string
  source: AttendeeSource
  createdAt: string
}

export type Selection = Keyed & {
  ticketRef: string
  slotId: string
  sessionId: string
  createdAt: string
}

export type Session = Keyed & {
  sessionId: string
  title: string
  speaker: string
  track: Track
  hallId: string
  slotId: string
  capacity: number
  seatsTaken: number
}

export type Hall = { id: string; name: string; capacity: number }
export type Slot = { id: string; label: string; startsAt: string; endsAt: string }

export type EventConfig = Keyed & {
  halls: Hall[]
  slots: Slot[]
  registrationOpen: boolean
}

export type Subscriber = Keyed & {
  email: string
  createdAt: string
}

/** Projection of a Session sent to the browser so the picker can show live seats. */
export type SeatCount = {
  sessionId: string
  seatsTaken: number
  capacity: number
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
