import { halls as fallbackHalls, slots as fallbackSlots } from '../../content/event'
import { getConfig, getReconcileSummary, getSessionsInSlot, listAttendees, listEmailEvents } from './queries'
import type { Attendee, EmailEvent, FoodPreference, Hall, ReconcileSummary, Slot, Tier } from './types'

export type HallSlotSeats = {
  slotId: string
  slotLabel: string
  capacity: number
  seatsTaken: number
  left: number
}

export type HallSeats = {
  hallId: string
  hallName: string
  slots: HallSlotSeats[]
  capacity: number
  seatsTaken: number
  left: number
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
  halls: HallSeats[]
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

  // Halls and slots are config, never hardcoded. Works for three halls or four.
  const halls: Hall[] = config?.halls ?? fallbackHalls
  const slots: Slot[] = config?.slots ?? fallbackSlots

  const sessionsPerSlot = await Promise.all(slots.map((slot) => getSessionsInSlot(slot.id)))

  const paidOnly = attendees.filter((a) => a.paymentStatus === 'paid')

  const hallSeats: HallSeats[] = halls.map((hall) => {
    const perSlot: HallSlotSeats[] = slots.map((slot, i) => {
      const session = sessionsPerSlot[i].find((s) => s.hallId === hall.id)
      const capacity = session?.capacity ?? 0
      const seatsTaken = session?.seatsTaken ?? 0
      return {
        slotId: slot.id,
        slotLabel: slot.label,
        capacity,
        seatsTaken,
        left: Math.max(0, capacity - seatsTaken),
      }
    })

    return {
      hallId: hall.id,
      hallName: hall.name,
      slots: perSlot,
      capacity: perSlot.reduce((n, s) => n + s.capacity, 0),
      seatsTaken: perSlot.reduce((n, s) => n + s.seatsTaken, 0),
      left: perSlot.reduce((n, s) => n + s.left, 0),
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
    halls: hallSeats,
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
