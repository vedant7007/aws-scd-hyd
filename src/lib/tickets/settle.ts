import { getAttendeeByOrder, getAttendeeWithSeats } from '../db/queries'
import { releaseItems, transactWithRetry } from '../db/seats'
import { keys } from '../db/keys'
import { tableName } from '../db/client'
import type { Attendee } from '../db/types'
import { isReservedAddress, sendEmail } from '../email/send'
import { confirmation } from '../email/templates'
import { markSent, verifyByProvider } from '../registration/state'
import type { PaymentEvent } from './razorpay'

/**
 * Razorpay mode only. Applies a verified payment event onto the same
 * lifecycle the manual flow uses: a capture is the one provider transition,
 * AWAITING_PAYMENT to VERIFIED, and it sends email 2 exactly as an admin
 * verify does. The webhook and the hourly reconcile both come through here,
 * so a lost webhook and a delivered one end in the same state by the same
 * code.
 *
 * Idempotent by construction: the transition is a conditional write, so a
 * replay finds nothing to do and sends nothing.
 */
export type SettleResult =
  | { outcome: 'paid'; passId: string; emailed: boolean }
  | { outcome: 'already-settled'; passId: string; state: Attendee['state'] }
  | { outcome: 'amount-mismatch'; passId: string; expected: number | undefined; got: number }
  | { outcome: 'refunded'; passId: string; seatsReleased: number }
  | { outcome: 'partial-refund'; passId: string }
  | { outcome: 'failed'; passId: string; reason: string }
  | { outcome: 'unknown-order'; orderId: string }

export async function settle(event: PaymentEvent): Promise<SettleResult> {
  const attendee = await getAttendeeByOrder(event.orderId)
  if (!attendee) return { outcome: 'unknown-order', orderId: event.orderId }
  const { passId } = attendee

  switch (event.type) {
    case 'captured': {
      if (attendee.amountPaise !== event.amountPaise) {
        return { outcome: 'amount-mismatch', passId, expected: attendee.amountPaise, got: event.amountPaise }
      }
      const out = await verifyByProvider(passId, event.paymentId, event.amountPaise)
      if (!out.ok) return { outcome: 'already-settled', passId, state: attendee.state }

      let emailed = false
      if (!isReservedAddress(out.attendee.email)) {
        try {
          await sendEmail({ to: out.attendee.email, ...confirmation(out.attendee) })
          await markSent(passId, 'confirmationSentAt')
          emailed = true
        } catch (err) {
          console.error('[settle] confirmation email failed, record kept, reconcile will retry', { passId, err })
        }
      }
      return { outcome: 'paid', passId, emailed }
    }

    case 'refunded': {
      if (!event.full) return { outcome: 'partial-refund', passId }
      if (attendee.state === 'REJECTED') return { outcome: 'already-settled', passId, state: 'REJECTED' }
      // The lifecycle has no refunded state. REJECTED is the one that closes
      // the pass, refuses the gate and says why; the seats go back with it.
      const { seats } = await getAttendeeWithSeats(passId)
      await transactWithRetry([
        {
          Update: {
            TableName: tableName(),
            Key: keys.attendee(passId),
            UpdateExpression: 'SET #state = :rejected, rejectionReason = :why',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: { ':rejected': 'REJECTED', ':why': `Refunded in full at the provider, payment ${event.paymentId}` },
          },
        },
        ...releaseItems(seats),
      ])
      return { outcome: 'refunded', passId, seatsReleased: seats.length }
    }

    case 'failed':
      // Nothing changes. The record stays where it is and the same person can
      // try again; the reason is logged by the caller for the ops trail only.
      return { outcome: 'failed', passId, reason: event.reason }
  }
}
