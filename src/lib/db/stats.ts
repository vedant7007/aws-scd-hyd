import { slots as fallbackSlots } from '../../content/event'
import { roomById, sessionSpecs, trackName } from '../../content/sessions'
import { tracks } from '../../content/tracks'
import { getAllSessions, getConfig, getReconcileSummary, getTrackCounters, listAttendees, listEmailEvents } from './queries'
import { REGISTRATION_STATES, type Attendee, type EmailEvent, type FoodPreference, type ReconcileSummary, type RegistrationState, type Slot, type Tier, type Track } from './types'

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

/** Amendment 1 section 6. A track counter against its ceiling. */
export type TrackLoad = { track: Track; trackName: string; registered: number; ceiling: number | null; seeded: boolean }

export type Dashboard = {
  attendees: Attendee[]
  total: number
  /** VERIFIED plus SESSIONS_SELECTED: the people actually coming. */
  paid: number
  byState: { state: RegistrationState; count: number }[]
  /** PENDING_VERIFICATION, oldest UTR first. The default admin view. */
  queue: Attendee[]
  /** VERIFIED with no sessions chosen, for chasing before the event. */
  unselected: Attendee[]
  trackLoad: TrackLoad[]
  sessionsReleased: boolean
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
  const [attendees, config, reconcile, bounces, complaints, counters] = await Promise.all([
    listAttendees(),
    getConfig(),
    getReconcileSummary(),
    listEmailEvents('bounce'),
    listEmailEvents('complaint'),
    getTrackCounters(),
  ])

  const slots: Slot[] = config?.slots ?? fallbackSlots
  const slotLabel = new Map(slots.map((s) => [s.id, s.label]))

  // Content says what the 12 sessions are; the table says how many seats each
  // has given out. A session content describes but the table lacks is shown
  // as not seeded rather than as empty.
  const specs = sessionSpecs()
  const stored = await getAllSessions()

  const paidOnly = attendees.filter((a) => a.state === 'VERIFIED' || a.state === 'SESSIONS_SELECTED')

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
    byState: REGISTRATION_STATES.map((state) => ({ state, count: attendees.filter((a) => a.state === state).length })),
    queue: attendees
      .filter((a) => a.state === 'PENDING_VERIFICATION')
      .sort((a, b) => (a.utrSubmittedAt ?? a.createdAt).localeCompare(b.utrSubmittedAt ?? b.createdAt)),
    unselected: attendees.filter((a) => a.state === 'VERIFIED').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    trackLoad: counters.map((c, i) => ({
      track: c?.track ?? (tracks[i]!.id as Track),
      trackName: trackName(c?.track ?? (tracks[i]!.id as Track)),
      registered: c?.registered ?? 0,
      ceiling: c?.ceiling ?? null,
      seeded: Boolean(c),
    })),
    sessionsReleased: config?.sessionsReleased ?? false,
    byTier: TIERS.map((tier) => ({ tier, count: paidOnly.filter((a) => a.tier === tier).length })),
    // Caterer numbers count people who are actually coming, not refunds.
    byFood: FOODS.map((food) => ({
      food,
      count: paidOnly.filter((a) => a.foodPreference === food).length,
    })),
    checkedIn: attendees.filter((a) => a.checkedInAt).length,
    swagIssued: attendees.filter((a) => a.swagIssuedAt).length,
    sessions,
    awaitingVerification: attendees.filter((a) => a.state === 'PENDING_VERIFICATION').length,
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
