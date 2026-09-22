import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb'
import { sessionIdFor, trackName } from '../../content/sessions'
import { slots } from '../../content/event'
import { ddb, tableName } from './client'
import { keys } from './keys'
import type { Seat, Track } from './types'

export type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Two transactions touching the same session at the same moment are not
 * judged on their conditions: DynamoDB cancels one outright with
 * TransactionConflict, and the SDK does not retry that. A campus registering
 * in a burst is exactly that case. So a conflicted transaction is retried
 * with jittered backoff until it is actually evaluated; only then does a
 * ConditionalCheckFailed mean what the caller thinks it means.
 */
export async function transactWithRetry(items: TransactItem[], attempts = 6): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await ddb.send(new TransactWriteCommand({ TransactItems: items }))
      return
    } catch (err) {
      const conflicted =
        err instanceof TransactionCanceledException && (err.CancellationReasons ?? []).some((r) => r.Code === 'TransactionConflict')
      if (!conflicted || attempt >= attempts) throw err
      await sleep(40 * attempt + Math.random() * 120)
    }
  }
}

/**
 * SPEC.md section 9, reshaped for tracks. A track choice is a seat in every
 * one of that track's sessions, claimed together or not at all: one
 * TransactWriteItems holds an increment on each session, conditional on
 * sellableCapacity, and a Seat item for each. A session with no
 * sellableCapacity fails the condition (the attribute is absent), so nothing
 * is ever sold against the physical count by default.
 *
 * The caller adds these items to its own transaction, so the attendee record
 * and its seats are written in one commit. If any one seat is short the whole
 * transaction is cancelled and cancelledTrack() names the track.
 */
export function claimTrackItems(ticketRef: string, tracks: Track[], now: string): { items: TransactItem[]; sessionAt: string[] } {
  const table = tableName()
  const items: TransactItem[] = []
  const sessionAt: string[] = []
  for (const track of tracks) {
    for (const slot of slots) {
      const sessionId = sessionIdFor(slot.id, track)
      items.push({
        Update: {
          TableName: table,
          Key: keys.session(sessionId),
          UpdateExpression: 'SET seatsTaken = seatsTaken + :one',
          ConditionExpression: 'seatsTaken < sellableCapacity',
          ExpressionAttributeValues: { ':one': 1 },
        },
      })
      sessionAt.push(sessionId)
      const seat: Seat = { ...keys.seat(ticketRef, sessionId), ticketRef, sessionId, slotId: slot.id, track, createdAt: now }
      items.push({ Put: { TableName: table, Item: seat, ConditionExpression: 'attribute_not_exists(SK)' } })
      sessionAt.push(sessionId)
    }
  }
  return { items, sessionAt }
}

/**
 * Which track a cancelled claim transaction fell over on. `offset` is how many
 * items the caller placed before the claim items. Null when the cancellation
 * was not a capacity condition on one of them.
 */
export function cancelledTrack(err: unknown, sessionAt: string[], offset: number): Track | null {
  if (!(err instanceof TransactionCanceledException)) return null
  const reasons = err.CancellationReasons ?? []
  for (let i = 0; i < sessionAt.length; i++) {
    if (reasons[offset + i]?.Code === 'ConditionalCheckFailed') {
      const sessionId = sessionAt[i]!
      return sessionId.slice(sessionId.indexOf('-') + 1) as Track
    }
  }
  return null
}

/** The message a student sees when their transaction was refused for a full track. */
export const trackFullMessage = (track: Track) =>
  `The ${trackName(track)} track is full, so nothing was booked. Pick a different track, or fewer tracks, and try again.`

/** Delete each seat and give it back to its session, as items for the caller's transaction. */
export function releaseSeatItems(seats: Seat[]): TransactItem[] {
  const table = tableName()
  return seats.flatMap((seat) => [
    // Conditional, so a seat released twice fails instead of decrementing twice.
    { Delete: { TableName: table, Key: keys.seat(seat.ticketRef, seat.sessionId), ConditionExpression: 'attribute_exists(SK)' } },
    {
      Update: {
        TableName: table,
        Key: keys.session(seat.sessionId),
        UpdateExpression: 'SET seatsTaken = seatsTaken - :one',
        ConditionExpression: 'seatsTaken > :zero',
        ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
      },
    },
  ])
}

export type RefineOutcome = { ok: true; released: number } | { ok: false; reason: 'not-held' | 'stale' }

/**
 * SHIPS LATER, behind sessionRefinementOpen. Narrowing a slot to one session:
 * the attendee already holds a seat in every one of their tracks' sessions in
 * that slot, so refining never claims, it only releases the others. It cannot
 * fail on capacity, and it is the transaction that recovers the seats a
 * multi-track tier holds but cannot sit in.
 */
export async function refineSlot(ticketRef: string, slotId: string, keepSessionId: string, held: Seat[]): Promise<RefineOutcome> {
  const inSlot = held.filter((s) => s.slotId === slotId)
  if (!inSlot.some((s) => s.sessionId === keepSessionId)) return { ok: false, reason: 'not-held' }
  const others = inSlot.filter((s) => s.sessionId !== keepSessionId)
  if (others.length === 0) return { ok: true, released: 0 }

  try {
    await transactWithRetry(releaseSeatItems(others))
    return { ok: true, released: others.length }
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err
    // A seat vanished underneath us: another tab refined first.
    return { ok: false, reason: 'stale' }
  }
}
