import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { keys } from './keys'
import type { Seat, Track } from './types'

export type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Two transactions touching the same item at the same moment are not judged
 * on their conditions: DynamoDB cancels one outright with TransactionConflict,
 * and the SDK does not retry that. A campus registering in a burst is exactly
 * that case. So a conflicted transaction is retried with jittered backoff
 * until it is actually evaluated; only then does a ConditionalCheckFailed mean
 * what the caller thinks it means.
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

/** Which items of a cancelled transaction failed their condition, by index. */
export function failedIndexes(err: unknown): number[] {
  if (!(err instanceof TransactionCanceledException)) return []
  return (err.CancellationReasons ?? []).flatMap((r, i) => (r.Code === 'ConditionalCheckFailed' ? [i] : []))
}

export type Pick = { sessionId: string; slotId: string; track: Track }

/**
 * SPEC.md section 9 and Amendment 2 section 4. One seat in each chosen
 * session, all in one TransactWriteItems: an increment on each session,
 * conditional on sellableCapacity, and a Seat item for each. Either every
 * seat is claimed or none is.
 *
 * `#capacity` aliases sellableCapacity. The attribute is not a reserved word,
 * but `capacity` is, and the bare name has bitten this repo once; the alias
 * stays so nobody reintroduces it. A session with no sellableCapacity fails
 * the condition (absent attribute), so nothing is ever sold against the
 * physical count by default.
 *
 * Two items per pick, session update then seat put, so the caller can map a
 * failed index back to the pick: pick = floor((index - offset) / 2).
 */
export function claimItems(passId: string, picks: Pick[], now: string): TransactItem[] {
  const table = tableName()
  return picks.flatMap((p) => [
    {
      Update: {
        TableName: table,
        Key: keys.session(p.sessionId),
        UpdateExpression: 'SET seatsTaken = seatsTaken + :one',
        ConditionExpression: 'seatsTaken < #capacity',
        ExpressionAttributeNames: { '#capacity': 'sellableCapacity' },
        ExpressionAttributeValues: { ':one': 1 },
      },
    },
    {
      Put: {
        TableName: table,
        Item: { ...keys.seat(passId, p.sessionId), passId, sessionId: p.sessionId, slotId: p.slotId, track: p.track, createdAt: now } satisfies Seat,
        ConditionExpression: 'attribute_not_exists(SK)',
      },
    },
  ])
}

/** The session whose seat ran out, from the failed item index. Null if the failure was elsewhere. */
export function filledSession(err: unknown, picks: Pick[], offset: number): string | null {
  for (const i of failedIndexes(err)) {
    const k = i - offset
    if (k >= 0 && k % 2 === 0 && k / 2 < picks.length) return picks[k / 2]!.sessionId
  }
  return null
}

/** Delete each seat and give it back to its session, as items for the caller's transaction. */
export function releaseItems(seats: Seat[]): TransactItem[] {
  const table = tableName()
  return seats.flatMap((seat) => [
    // Conditional, so a seat released twice fails instead of decrementing twice.
    { Delete: { TableName: table, Key: keys.seat(seat.passId, seat.sessionId), ConditionExpression: 'attribute_exists(SK)' } },
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
