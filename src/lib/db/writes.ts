import { ConditionalCheckFailedException, TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { gsi1, keys, newPassToken, newToken, normaliseEmail } from './keys'
import { getAttendee, getAttendeeWithSeats } from './queries'
import { cancelledTrack, claimTrackItems, releaseSeatItems, transactWithRetry, type TransactItem } from './seats'
import type { Attendee, OrderPointer, PaymentMode, Track } from './types'

export type Registration = {
  name: string
  email: string
  phone: string
  college: string
  tier: Attendee['tier']
  /** Distinct, validated against the tier's tracksAllowed by the caller. */
  tracks: Track[]
  foodPreference: Attendee['foodPreference']
}

export type PaymentSetup = {
  mode: PaymentMode
  /** Decided by the server from content. Never from the client. */
  amountPaise: number
  /** Razorpay only. */
  orderId?: string
  /** Manual only. When the seats go back if no UTR arrives. */
  holdUntil?: string
}

export type CreateOutcome =
  | { ok: true; attendee: Attendee }
  /** One of the chosen tracks had no seat left in some session. Nothing was written. */
  | { ok: false; reason: 'track-full'; track: Track }
  /** The random ticket reference collided. Nothing was written; the caller mints another. */
  | { ok: false; reason: 'ref-collision' }

/**
 * The record behind a registration, and its seats, in ONE transaction. It is
 * pending, has no passToken and so cannot open a pass, and carries the amount
 * the server decided so settle can check what was actually paid.
 *
 * The seats are claimed here, at creation, not at verification: two people
 * cannot both pay for the last seat if the second one could never register.
 * Every session of every chosen track is claimed together; if any one is
 * short the whole transaction is cancelled and the student is told which
 * track, never a partial hold.
 *
 * For Razorpay the order pointer rides in the same transaction, so an order
 * that exists at the provider with no way back to a record here is impossible.
 */
export async function createPendingAttendee(
  ticketRef: string,
  reg: Registration,
  payment: PaymentSetup,
): Promise<CreateOutcome> {
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
    tracks: reg.tracks,
    foodPreference: reg.foodPreference,
    paymentStatus: 'pending',
    paymentMode: payment.mode,
    amountPaise: payment.amountPaise,
    ...(payment.orderId ? { orderId: payment.orderId } : {}),
    ...(payment.holdUntil ? { holdUntil: payment.holdUntil } : {}),
    checkoutToken: newToken(),
    source: 'checkout',
    createdAt: now,
  }

  const head: TransactItem[] = [
    { Put: { TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
  ]
  if (payment.orderId) {
    const pointer: OrderPointer = { ...keys.order(payment.orderId), orderId: payment.orderId, ticketRef }
    head.push({ Put: { TableName: table, Item: pointer, ConditionExpression: 'attribute_not_exists(PK)' } })
  }

  const claim = claimTrackItems(ticketRef, reg.tracks, now)

  try {
    await transactWithRetry([...head, ...claim.items])
    return { ok: true, attendee: item }
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err
    const track = cancelledTrack(err, claim.sessionAt, head.length)
    if (track) return { ok: false, reason: 'track-full', track }
    if (err.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed') return { ok: false, reason: 'ref-collision' }
    throw err
  }
}

/**
 * pending to paid, exactly once. SPEC.md section 8 step 3, reshaped for a
 * gateway: the record already exists, so idempotency is a conditional update
 * on the status rather than a conditional put.
 *
 * The passToken is minted here and only here. A replayed event, or an admin
 * confirming twice, loses the condition, gets settled: false, and the token
 * already in someone's inbox is left alone. The amount is checked against
 * what the record was created for, so a payment for the wrong sum, however it
 * came about, never marks anyone paid.
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
          'SET paymentStatus = :paid, passToken = :token, GSI1PK = :g1pk, GSI1SK = :g1sk, paymentId = :pid, paidAt = :now REMOVE holdUntil',
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
  const { attendee, seats } = await getAttendeeWithSeats(ticketRef)
  if (!attendee) return { seatsReleased: 0 }

  await transactWithRetry([
    {
      Update: {
        TableName: table,
        Key: keys.attendee(ticketRef),
        UpdateExpression: 'SET paymentStatus = :status',
        ExpressionAttributeValues: { ':status': paymentStatus },
      },
    },
    ...releaseSeatItems(seats),
  ])

  return { seatsReleased: seats.length }
}

/**
 * A pending record whose hold has lapsed with no UTR. Marked expired and its
 * seats released in one transaction, conditional on it still being pending
 * with no UTR, so a student who submitted in the meantime keeps their seats
 * and a sweep that races itself does nothing twice. A rejected UTR does not
 * expire the hold: the student usually resubmits, so the seats stay until a
 * later sweep finds the record genuinely abandoned.
 */
export async function expireHold(ticketRef: string): Promise<{ expired: boolean; seatsReleased: number }> {
  const table = tableName()
  const { attendee, seats } = await getAttendeeWithSeats(ticketRef)
  if (!attendee || attendee.paymentStatus !== 'pending' || attendee.utr) return { expired: false, seatsReleased: 0 }

  try {
    await transactWithRetry([
      {
        Update: {
          TableName: table,
          Key: keys.attendee(ticketRef),
          UpdateExpression: 'SET paymentStatus = :expired REMOVE holdUntil',
          ConditionExpression: 'paymentStatus = :pending AND attribute_not_exists(utr)',
          ExpressionAttributeValues: { ':expired': 'expired', ':pending': 'pending' },
        },
      },
      ...releaseSeatItems(seats),
    ])
    return { expired: true, seatsReleased: seats.length }
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err
    return { expired: false, seatsReleased: 0 }
  }
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
