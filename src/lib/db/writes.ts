import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { TicketEvent } from '../tickets/provider'
import { ddb, tableName } from './client'
import { gsi1, keys, newPassToken, normaliseEmail } from './keys'
import { getAttendeeWithSelections } from './queries'
import type { Attendee } from './types'

/**
 * Providers retry webhooks. A duplicate attendee is the single most likely bug
 * in this system, see SPEC.md section 8, so creation is a conditional put and
 * a losing put falls back to updating the row that is already there.
 *
 * passToken and createdAt are written once and never overwritten, otherwise a
 * retry would silently invalidate a pass link already sitting in an inbox.
 */
export async function upsertAttendeeFromTicket(
  event: TicketEvent,
): Promise<{ created: boolean; attendee: Attendee }> {
  const table = tableName()
  const passToken = newPassToken()
  const now = new Date().toISOString()

  const item: Attendee = {
    ...keys.attendee(event.ticketRef),
    ...gsi1.attendeeByToken(passToken),
    ticketRef: event.ticketRef,
    passToken,
    name: event.name,
    email: normaliseEmail(event.email),
    phone: event.phone,
    college: event.college,
    tier: event.tier,
    foodPreference: event.foodPreference,
    paymentStatus: 'paid',
    source: 'webhook',
    createdAt: now,
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    )
    return { created: true, attendee: item }
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
  }

  // Already there. Refresh only the fields the provider owns.
  const updated = await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: keys.attendee(event.ticketRef),
      UpdateExpression:
        'SET #name = :name, email = :email, phone = :phone, college = :college, tier = :tier, foodPreference = :food, paymentStatus = :paid, #src = :src',
      ExpressionAttributeNames: { '#name': 'name', '#src': 'source' },
      ExpressionAttributeValues: {
        ':name': event.name,
        ':email': normaliseEmail(event.email),
        ':phone': event.phone,
        ':college': event.college,
        ':tier': event.tier,
        ':food': event.foodPreference,
        ':paid': 'paid',
        ':src': 'webhook',
      },
      ReturnValues: 'ALL_NEW',
    }),
  )

  return { created: false, attendee: updated.Attributes as Attendee }
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
