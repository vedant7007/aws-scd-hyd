import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { gsi1, keys, newPassToken, newToken, normaliseEmail } from './keys'
import { getAttendee, getAttendeeWithSelections } from './queries'
import type { Attendee, OrderPointer } from './types'

export type Registration = {
  name: string
  email: string
  phone: string
  college: string
  tier: Attendee['tier']
  foodPreference: Attendee['foodPreference']
}

/**
 * The record behind an order, written before any money moves. It is pending,
 * has no passToken and so cannot open a pass, and carries the amount the
 * server decided on so the webhook can check what was actually paid.
 *
 * The order pointer goes in the same transaction: an order that exists at the
 * provider with no way back to a record here is the one that would get lost.
 * The put is conditional on the ticket reference being new, so a collision in
 * the six random characters fails loudly rather than overwriting someone.
 */
export async function createPendingAttendee(
  ticketRef: string,
  reg: Registration,
  order: { orderId: string; amountPaise: number },
): Promise<Attendee> {
  const table = tableName()
  const now = new Date().toISOString()

  const item: Attendee = {
    ...keys.attendee(ticketRef),
    ticketRef,
    name: reg.name,
    email: normaliseEmail(reg.email),
    phone: reg.phone,
    college: reg.college,
    tier: reg.tier,
    foodPreference: reg.foodPreference,
    paymentStatus: 'pending',
    orderId: order.orderId,
    amountPaise: order.amountPaise,
    checkoutToken: newToken(),
    source: 'checkout',
    createdAt: now,
  }

  const pointer: OrderPointer = { ...keys.order(order.orderId), orderId: order.orderId, ticketRef }

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
        { Put: { TableName: table, Item: pointer, ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }),
  )

  return item
}

/**
 * pending to paid, exactly once. SPEC.md section 8 step 3, reshaped for a
 * gateway: the record already exists, so idempotency is a conditional update
 * on the status rather than a conditional put.
 *
 * The passToken is minted here and only here. A replayed webhook loses the
 * condition, gets settled: false, and the token already in someone's inbox is
 * left alone. The amount is checked against what the order was created for,
 * so a payment for the wrong sum, however it came about, never marks anyone
 * paid.
 */
export async function markPaid(
  ticketRef: string,
  payment: { paymentId: string; amountPaise: number },
): Promise<{ settled: boolean; attendee: Attendee }> {
  const table = tableName()
  const passToken = newPassToken()
  const token = gsi1.attendeeByToken(passToken)
  const now = new Date().toISOString()

  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: keys.attendee(ticketRef),
        UpdateExpression:
          'SET paymentStatus = :paid, passToken = :token, GSI1PK = :g1pk, GSI1SK = :g1sk, paymentId = :pid, paidAt = :now',
        ConditionExpression: 'paymentStatus = :pending AND amountPaise = :amount',
        ExpressionAttributeValues: {
          ':paid': 'paid',
          ':pending': 'pending',
          ':token': passToken,
          ':g1pk': token.GSI1PK,
          ':g1sk': token.GSI1SK,
          ':pid': payment.paymentId,
          ':now': now,
          ':amount': payment.amountPaise,
        },
        ReturnValues: 'ALL_NEW',
      }),
    )
    return { settled: true, attendee: res.Attributes as Attendee }
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
  }

  // Already settled, or the amount did not match. The caller tells them apart.
  const existing = await getAttendee(ticketRef)
  if (!existing) throw new Error(`markPaid: ${ticketRef} vanished between the update and the read`)
  return { settled: false, attendee: existing }
}

/**
 * Cancellation or refund. Marks the attendee and frees every seat they hold in
 * the same transaction, so a seat is never left claimed by someone who is not
 * coming, and never double released.
 */
export async function deactivateAttendee(
  ticketRef: string,
  paymentStatus: 'cancelled' | 'refunded',
): Promise<{ seatsReleased: number }> {
  const table = tableName()
  const { attendee, selections } = await getAttendeeWithSelections(ticketRef)
  if (!attendee) return { seatsReleased: 0 }

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: table,
            Key: keys.attendee(ticketRef),
            UpdateExpression: 'SET paymentStatus = :status',
            ExpressionAttributeValues: { ':status': paymentStatus },
          },
        },
        ...selections.flatMap((selection) => [
          {
            Delete: {
              TableName: table,
              Key: keys.selection(ticketRef, selection.slotId),
            },
          },
          {
            Update: {
              TableName: table,
              Key: keys.session(selection.sessionId),
              UpdateExpression: 'SET seatsTaken = seatsTaken - :one',
              ConditionExpression: 'seatsTaken > :zero',
              ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
            },
          },
        ]),
      ],
    }),
  )

  return { seatsReleased: selections.length }
}

/** Records that the confirmation email was accepted. First write wins. */
export async function markConfirmationSent(ticketRef: string): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: keys.attendee(ticketRef),
        UpdateExpression: 'SET confirmationSentAt = :now',
        ConditionExpression: 'attribute_not_exists(confirmationSentAt)',
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
      }),
    )
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
  }
}
