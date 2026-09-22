import { slots as fallbackSlots } from '../../content/event'
import { roomById, sessionSpecs, trackName } from '../../content/sessions'
import { getAllSessions, getConfig, getReconcileSummary, listAttendees, listEmailEvents } from './queries'
import type { Attendee, EmailEvent, FoodPreference, ReconcileSummary, Slot, Tier, Track } from './types'

/**
 * One session, both capacity numbers side by side. sold is seats held, by
 * paid and pending records alike, since a pending record holds real seats.
 * reserve is what is kept back from sale; free is what is physically unsold.
 * Nulls are TODO(vedant): no room assigned, or no sellable count decided.
 */
export type SessionSeats = {
  sessionId: string
  slotId: string
  slotLabel: string
  track: Track
  trackName: string
  roomName: string | null
  title: string | null
  seeded: boolean
  sold: number
  sellable: number | null
  physical: number | null
  /** physical minus sellable: seats held back from sale. */
  reserve: number | null
  /** physical minus sold: seats physically still free, reserve included. */
  free: number | null
}

export type Dashboard = {
  attendees: Attendee[]
  total: number
  paid: number
  /** Checkouts started and not paid: abandoned, failed, or a webhook still in flight. */
  pending: number
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
const FOODS: FoodPreference[] = ['veg', 'nonveg', 'jain']

/**
 * Everything the dashboard shows, in one pass. The attendee list comes from a
 * scan on purpose, see SPEC.md section 6, and the aggregates are computed here
 * rather than with extra queries.
 */
export async function loadDashboard(): Promise<Dashboard> {
  const [attendees, config, reconcile, bounces, complaints] = await Promise.all([
    listAttendees(),
    getConfig(),
    getReconcileSummary(),
    listEmailEvents('bounce'),
    listEmailEvents('complaint'),
  ])

  const slots: Slot[] = config?.slots ?? fallbackSlots
  const slotLabel = new Map(slots.map((s) => [s.id, s.label]))

  // Content says what the 12 sessions are; the table says how many seats each
  // has given out. A session content describes but the table lacks is shown
  // as not seeded rather than as empty.
  const specs = sessionSpecs()
  const stored = await getAllSessions()

  const paidOnly = attendees.filter((a) => a.paymentStatus === 'paid')

  const sessions: SessionSeats[] = specs.map((spec, i) => {
    const item = stored[i]
    const sold = item?.seatsTaken ?? 0
    const sellable = item ? item.sellableCapacity : spec.sellableCapacity
    const physical = item ? item.physicalCapacity : spec.physicalCapacity
    return {
      sessionId: spec.sessionId,
      slotId: spec.slotId,
      slotLabel: slotLabel.get(spec.slotId) ?? spec.slotId,
      track: spec.track,
      trackName: trackName(spec.track),
      roomName: roomById(item?.roomId ?? spec.roomId)?.name ?? null,
      title: item?.title ?? spec.title,
      seeded: Boolean(item),
      sold,
      sellable,
      physical,
      reserve: physical !== null && sellable !== null ? physical - sellable : null,
      free: physical !== null ? physical - sold : null,
    }
  })

  return {
    attendees,
    total: attendees.length,
    paid: paidOnly.length,
    pending: attendees.filter((a) => a.paymentStatus === 'pending').length,
    byTier: TIERS.map((tier) => ({ tier, count: paidOnly.filter((a) => a.tier === tier).length })),
    // Caterer numbers count people who are actually coming, not refunds.
    byFood: FOODS.map((food) => ({
      food,
      count: paidOnly.filter((a) => a.foodPreference === food).length,
    })),
    checkedIn: attendees.filter((a) => a.checkedInAt).length,
    swagIssued: attendees.filter((a) => a.swagIssuedAt).length,
    sessions,
    awaitingVerification: attendees.filter((a) => a.paymentStatus === 'pending' && a.verification === 'awaiting').length,
    reconcile,
    email: {
      bounces: bounces.length,
      complaints: complaints.length,
      // Suppression is the whole point. If it failed, someone needs to see it.
      // A note means it was not attempted for a stated reason, not a failure.
      unsuppressed: [...bounces, ...complaints].filter((e) => !e.suppressed && !e.note).length,
      recent: [...bounces, ...complaints].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 10),
      confirmationsOwed: paidOnly.filter((a) => !a.confirmationSentAt && !/@example\.test$/i.test(a.email)).length,
    },
  }
}

/** RFC 4180 enough: quote every field and double any inner quote. */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}
