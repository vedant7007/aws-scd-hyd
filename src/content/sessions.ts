import type { Room, Session, Track } from '../lib/db/types'
import { roomForTrack, rooms, sessionDetails, slots } from './event'
import { tracks } from './tracks'

/** "<slot>-<track>", the one place the session id is spelled. */
export const sessionIdFor = (slotId: string, track: Track) => `${slotId}-${track}`

export const roomById = (id: string | null | undefined): Room | undefined =>
  id ? rooms.find((r) => r.id === id) : undefined

/** The room a track runs in, or undefined while TODO(vedant) leaves it unassigned. */
export const roomForTrackId = (track: Track): Room | undefined => roomById(roomForTrack[track])

/** Rooms that host sessions. The buffer room is never one of them. */
export const trackRooms = () => rooms.filter((r) => r.role === 'track')

/**
 * The 12 sessions as content describes them, without table keys or seat
 * counts: 3 tracks x 4 slots, each in its track's room (or none), each with
 * whatever detail sessionDetails carries. The seed writes these; the launch
 * guard checks them; the picker and schedule read the table copies.
 *
 * sellableCapacity is capped at the room's physical count so content cannot
 * oversell a room by typo.
 */
export type SessionSpec = Omit<Session, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'seatsTaken'>

export function sessionSpecs(): SessionSpec[] {
  return slots.flatMap((slot) =>
    tracks.map((track) => {
      const sessionId = sessionIdFor(slot.id, track.id)
      const room = roomForTrackId(track.id)
      const detail = sessionDetails[sessionId] ?? {}
      const physical = room?.physicalCapacity ?? null
      const sellable =
        detail.sellableCapacity === undefined ? null : physical === null ? null : Math.min(detail.sellableCapacity, physical)
      return {
        sessionId,
        slotId: slot.id,
        track: track.id,
        roomId: room?.id ?? null,
        title: detail.title ?? null,
        speaker: detail.speaker ?? null,
        type: detail.type ?? null,
        physicalCapacity: physical,
        sellableCapacity: sellable,
      }
    }),
  )
}

/** Every session of one track, in slot order. What a track choice claims. */
export const sessionIdsForTrack = (track: Track) => slots.map((slot) => sessionIdFor(slot.id, track))

export const trackName = (id: Track) => tracks.find((t) => t.id === id)?.name ?? id
