export type Tier = 'basic' | 'premium' | 'ultra' | 'vip'
export type FoodPreference = 'veg' | 'nonveg' | 'jain'
export type PaymentStatus = 'paid' | 'refunded' | 'cancelled'
export type AttendeeSource = 'webhook' | 'reconcile' | 'manual'
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
  passToken: string
  name: string
  /** Always lowercased on write. */
  email: string
  phone: string
  college: string
  tier: Tier
  foodPreference: FoodPreference
  paymentStatus: PaymentStatus
  checkedInAt?: string
  swagIssuedAt?: string
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

/** Summary of the most recent reconciliation run, SPEC.md section 8. */
export type ReconcileSummary = Keyed & {
  ranAt: string
  provider: string
  checked: number
  inserted: number
  deactivated: number
  mismatches: number
  ok: boolean
  error?: string
}
