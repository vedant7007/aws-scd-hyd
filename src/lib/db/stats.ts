import { programSessions, type ProgramSession } from '../../content/program'
import { getReconcileSummary, getSessions, listAttendees, listEmailEvents } from './queries'
import { REGISTRATION_STATES, type Attendee, type EmailEvent, type FoodPreference, type ReconcileSummary, type RegistrationState, type Tier } from './types'

/**
 * One technical session or workshop against its ceiling. sold is seats held,
 * by paid, pending and unpaid-but-holding records alike, since each holds a
 * real seat until it is verified or its hold lapses. sellable is null until
 * an admin sizes the session, and nothing sells until then.
 */
export type SessionSeats = ProgramSession & {
  /** An admin has set a size, so the counter exists. */
  sized: boolean
  sold: number
  sellable: number | null
  /** sellable minus sold. */
  free: number | null
  /** Of sold, how many are verified: people actually coming. */
  verified: number
}

export type Dashboard = {
  /** Every record, preview ones included, for the admin table. */
  attendees: Attendee[]
  /** Records made through the flow, not the admin preview. What every count below reads. */
  total: number
  /** VERIFIED: the people actually coming. */
  paid: number
  byState: { state: RegistrationState; count: number }[]
  /** PENDING_VERIFICATION, oldest UTR first. The default admin view. Preview records included, marked. */
  queue: Attendee[]
  byTier: { tier: Tier; count: number }[]
  byFood: { food: FoodPreference; count: number }[]
  checkedIn: number
  swagIssued: number
  sessions: SessionSeats[]
  /** Manual payments with a UTR waiting for an admin. */
  awaitingVerification: number
  reconcile: ReconcileSummary | null
  email: {
    bounces: number
    complaints: number
    /** Anything recorded that could not be added to the suppression list. */
    unsuppressed: number
    /** Newest first, capped, for the dashboard list. */
    recent: EmailEvent[]
    confirmationsOwed: number
  }
}

const TIERS: Tier[] = ['basic', 'premium', 'ultra', 'vip']
const FOODS: FoodPreference[] = ['veg', 'nonveg']

/**
 * Everything the dashboard shows, in one pass. The attendee list comes from a
 * scan on purpose, see SPEC.md section 6, and the aggregates are computed here
 * rather than with extra queries.
 */
export async function loadDashboard(): Promise<Dashboard> {
  const [attendees, reconcile, bounces, complaints, stored] = await Promise.all([
    listAttendees(),
    getReconcileSummary(),
    listEmailEvents('bounce'),
    listEmailEvents('complaint'),
    getSessions(),
  ])

  // An admin walking the flow through the preview makes real records. They
  // are theirs to verify or reject, but they are nobody's lunch.
  const real = attendees.filter((a) => a.source !== 'preview')
  const paid = real.filter((a) => a.state === 'VERIFIED')

  const sessions: SessionSeats[] = programSessions.map((spec, i) => {
    const item = stored[i]
    const sold = item?.seatsTaken ?? 0
    const sellable = item?.sellableCapacity ?? null
    return {
      ...spec,
      sized: Boolean(item),
      sold,
      sellable,
      free: sellable !== null ? sellable - sold : null,
      verified: paid.filter((a) => a.technicalSession === spec.id || a.workshop === spec.id).length,
    }
  })

  return {
    attendees,
    total: real.length,
    paid: paid.length,
    byState: REGISTRATION_STATES.map((state) => ({ state, count: real.filter((a) => a.state === state).length })),
    queue: attendees
      .filter((a) => a.state === 'PENDING_VERIFICATION')
      .sort((a, b) => (a.utrSubmittedAt ?? a.createdAt).localeCompare(b.utrSubmittedAt ?? b.createdAt)),
    byTier: TIERS.map((tier) => ({ tier, count: paid.filter((a) => a.tier === tier).length })),
    // Caterer numbers count people who are actually coming, not refunds.
    byFood: FOODS.map((food) => ({ food, count: paid.filter((a) => a.foodPreference === food).length })),
    checkedIn: real.filter((a) => a.checkedInAt).length,
    swagIssued: real.filter((a) => a.swagIssuedAt).length,
    sessions,
    awaitingVerification: real.filter((a) => a.state === 'PENDING_VERIFICATION').length,
    reconcile,
    email: {
      bounces: bounces.length,
      complaints: complaints.length,
      // Suppression is the whole point. If it failed, someone needs to see it.
      // A note means it was not attempted for a stated reason, not a failure.
      unsuppressed: [...bounces, ...complaints].filter((e) => !e.suppressed && !e.note).length,
      recent: [...bounces, ...complaints].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 10),
      confirmationsOwed: paid.filter((a) => !a.confirmationSentAt && !/@example\.test$/i.test(a.email)).length,
    },
  }
}

/** RFC 4180 enough: quote every field and double any inner quote. */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}
