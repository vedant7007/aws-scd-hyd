import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { keys } from './keys'
import type { Selection } from './types'

export async function getSelection(ticketRef: string, slotId: string): Promise<Selection | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: keys.selection(ticketRef, slotId) }),
  )
  return (res.Item as Selection | undefined) ?? null
}

export type ClaimOutcome =
  | { ok: true }
  /** The hall filled up while they were deciding. */
  | { ok: false; reason: 'full' }
  /** Their own selection changed underneath us, another tab most likely. */
  | { ok: false; reason: 'stale' }

/**
 * SPEC.md section 9. One TransactWriteItems, never a separate increment and
 * decrement, so a crash between two calls cannot leak or duplicate a seat.
 *
 * The put carries its own condition describing the selection we read. If it
 * changed between the read and the write, the whole transaction is cancelled
 * rather than releasing a seat the attendee no longer holds.
 */
export async function claimSeat(args: {
  ticketRef: string
  slotId: string
  newSessionId: string
  previousSessionId: string | null
}): Promise<ClaimOutcome> {
  const { ticketRef, slotId, newSessionId, previousSessionId } = args
  if (previousSessionId === newSessionId) return { ok: true }

  const table = tableName()

  const claim = {
    Update: {
      TableName: table,
      Key: keys.session(newSessionId),
      UpdateExpression: 'SET seatsTaken = seatsTaken + :one',
      // capacity is a DynamoDB reserved word, so it has to be aliased.
      ConditionExpression: 'seatsTaken < #capacity',
      ExpressionAttributeNames: { '#capacity': 'capacity' },
      ExpressionAttributeValues: { ':one': 1 },
    },
  }

  const write = {
    Put: {
      TableName: table,
      Item: {
        ...keys.selection(ticketRef, slotId),
        ticketRef,
        slotId,
        sessionId: newSessionId,
        createdAt: new Date().toISOString(),
      },
      ...(previousSessionId === null
        ? { ConditionExpression: 'attribute_not_exists(SK)' }
        : {
            ConditionExpression: 'sessionId = :prev',
            ExpressionAttributeValues: { ':prev': previousSessionId },
          }),
    },
  }

  const release = previousSessionId
    ? [
        {
          Update: {
            TableName: table,
            Key: keys.session(previousSessionId),
            UpdateExpression: 'SET seatsTaken = seatsTaken - :one',
            ConditionExpression: 'seatsTaken > :zero',
            ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
          },
        },
      ]
    : []

  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: [claim, write, ...release] }))
    return { ok: true }
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err

    // Item order is claim, write, release. Which one failed tells the attendee
    // what actually happened instead of a generic error.
    const reasons = err.CancellationReasons ?? []
    if (reasons[0]?.Code === 'ConditionalCheckFailed') return { ok: false, reason: 'full' }
    return { ok: false, reason: 'stale' }
  }
}
