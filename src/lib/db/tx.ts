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
 * increment is conditional on staying under sellableCapacity, and a session
 * whose capacity is unset (null, or never written) fails the comparison, so
 * nothing ever sells against a room nobody has sized.
 *
 * `#capacity` aliases sellableCapacity: `capacity` alone is a reserved word
 * and the bare name has bitten this repo once.
 */
export function claimSeat(sessionId: string): TransactItem {
  return {
    Update: {
      TableName: tableName(),
      Key: keys.session(sessionId),
      UpdateExpression: 'SET seatsTaken = seatsTaken + :one',
      ConditionExpression: 'seatsTaken < #capacity',
      ExpressionAttributeNames: { '#capacity': 'sellableCapacity' },
      ExpressionAttributeValues: { ':one': 1 },
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
