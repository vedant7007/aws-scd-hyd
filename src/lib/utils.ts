import type { Slot } from './db/types'

const valid = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const time = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

/**
 * "10:30 to 11:15" once a slot has times, null while the organiser has not
 * set them. Null, never an empty string, a dash or "Invalid Date": a start
 * that does not parse is treated as unset, and an end that does not parse
 * is dropped.
 */
export function slotTime(slot: Pick<Slot, 'startsAt' | 'endsAt'>): string | null {
  const start = valid(slot.startsAt)
  if (!start) return null
  const end = valid(slot.endsAt)
  return end ? `${time(start)} to ${time(end)}` : time(start)
}

/** The slot's name, "Slot 1" through "Slot 4" when the label is missing or blank. */
export function slotLabel(slot: Pick<Slot, 'label'>, index: number): string {
  const label = typeof slot.label === 'string' ? slot.label.trim() : ''
  return label || `Slot ${index + 1}`
}
