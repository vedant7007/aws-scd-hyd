import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { keys } from './keys'

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

/**
 * One seat in a session, as an item for the caller's transaction. The
 * increment is conditional on staying under sellableCapacity. A session
 * nobody has given a seat count (no counter item, or a null ceiling) has no
 * limit: the seat is still counted, so a limit set later on the settings
 * page starts from the true number. Organiser decision, 29 September 2026:
 * registration opens before the room sizes are final.
 *
 * `#capacity` aliases sellableCapacity: `capacity` alone is a reserved word
 * and the bare name has bitten this repo once.
 */
export function claimSeat(sessionId: string): TransactItem {
  return {
    Update: {
      TableName: tableName(),
      Key: keys.session(sessionId),
      UpdateExpression: 'SET seatsTaken = if_not_exists(seatsTaken, :zero) + :one, sessionId = :sid',
      ConditionExpression: 'attribute_not_exists(#capacity) OR attribute_type(#capacity, :null) OR seatsTaken < #capacity',
      ExpressionAttributeNames: { '#capacity': 'sellableCapacity' },
      ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':sid': sessionId, ':null': 'NULL' },
    },
  }
}

/** Gives a seat back. Conditional, so a count can never go below zero. */
export function releaseSeat(sessionId: string): TransactItem {
  return {
    Update: {
      TableName: tableName(),
      Key: keys.session(sessionId),
      UpdateExpression: 'SET seatsTaken = seatsTaken - :one',
      ConditionExpression: 'seatsTaken > :zero',
      ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
    },
  }
}

/**
 * n seats in one session at once, for a group: a transaction may touch an
 * item only once, so four people in one session are one claim of four.
 * DynamoDB conditions cannot add, so the caller passes the ceiling it read
 * (null for an unsized session) and the condition pins it: if an admin
 * changes the ceiling in between, the claim fails and nothing is written.
 */
export function claimSeats(sessionId: string, n: number, capacity: number | null): TransactItem {
  const sized = capacity !== null
  return {
    Update: {
      TableName: tableName(),
      Key: keys.session(sessionId),
      UpdateExpression: 'SET seatsTaken = if_not_exists(seatsTaken, :zero) + :n, sessionId = :sid',
      ConditionExpression: sized
        ? '#capacity = :cap AND (attribute_not_exists(seatsTaken) OR seatsTaken <= :room)'
        : 'attribute_not_exists(#capacity) OR attribute_type(#capacity, :null)',
      ExpressionAttributeNames: { '#capacity': 'sellableCapacity' },
      ExpressionAttributeValues: sized
        ? { ':n': n, ':zero': 0, ':sid': sessionId, ':cap': capacity, ':room': capacity - n }
        : { ':n': n, ':zero': 0, ':sid': sessionId, ':null': 'NULL' },
    },
  }
}

/** n seats back at once. Conditional, so a count can never go below zero. */
export function releaseSeats(sessionId: string, n: number): TransactItem {
  return {
    Update: {
      TableName: tableName(),
      Key: keys.session(sessionId),
      UpdateExpression: 'SET seatsTaken = seatsTaken - :n',
      ConditionExpression: 'seatsTaken >= :n',
      ExpressionAttributeValues: { ':n': n },
    },
  }
}
