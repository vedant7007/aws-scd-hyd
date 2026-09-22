import type { Slot } from './db/types'

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

/** "10:30 to 11:15" once a slot has times, null while TODO(vedant) leaves them unset. */
export function slotTime(slot: Pick<Slot, 'startsAt' | 'endsAt'>): string | null {
  if (!slot.startsAt) return null
  return slot.endsAt ? `${time(slot.startsAt)} to ${time(slot.endsAt)}` : time(slot.startsAt)
}
