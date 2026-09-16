import { getAttendeeByOrder } from '../db/queries'
import type { Attendee, PaidAttendee } from '../db/types'
import { deactivateAttendee, markConfirmationSent, markPaid } from '../db/writes'
import { sendEmail } from '../email/send'
import { confirmation } from '../email/templates'
import type { PaymentEvent } from './razorpay'

/**
 * Applies a verified payment event. The webhook and the hourly reconcile both
 * come through here, so a lost webhook and a delivered one end in the same
 * state by the same code.
 *
 * Idempotent by construction: markPaid is a conditional update, so a replay
 * finds nothing to do and sends nothing. The confirmation goes out only on the
 * one call that moved the record to paid. If SES fails on that call the
 * record stays paid with no confirmationSentAt, and reconcile sends it later.
 */
export type SettleResult =
  | { outcome: 'paid'; ticketRef: string; emailed: boolean }
  | { outcome: 'already-settled'; ticketRef: string; status: Attendee['paymentStatus'] }
  | { outcome: 'amount-mismatch'; ticketRef: string; expected: number | undefined; got: number }
  | { outcome: 'refunded'; ticketRef: string; seatsReleased: number }
  | { outcome: 'partial-refund'; ticketRef: string }
  | { outcome: 'failed'; ticketRef: string; reason: string }
  | { outcome: 'unknown-order'; orderId: string }

export async function settle(event: PaymentEvent): Promise<SettleResult> {
  const attendee = await getAttendeeByOrder(event.orderId)
  if (!attendee) return { outcome: 'unknown-order', orderId: event.orderId }
  const { ticketRef } = attendee

  switch (event.type) {
    case 'captured': {
      if (attendee.amountPaise !== event.amountPaise) {
        return { outcome: 'amount-mismatch', ticketRef, expected: attendee.amountPaise, got: event.amountPaise }
      }
      const { settled, attendee: after } = await markPaid(ticketRef, {
        paymentId: event.paymentId,
        amountPaise: event.amountPaise,
      })
      if (!settled) return { outcome: 'already-settled', ticketRef, status: after.paymentStatus }

      const paid = after as PaidAttendee
      let emailed = false
      try {
        await sendEmail({ to: paid.email, ...confirmation(paid) })
        await markConfirmationSent(ticketRef)
        emailed = true
      } catch (err) {
        console.error('[settle] confirmation email failed, record kept, reconcile will retry', { ticketRef, err })
      }
      return { outcome: 'paid', ticketRef, emailed }
    }

    case 'refunded': {
      if (!event.full) return { outcome: 'partial-refund', ticketRef }
      if (attendee.paymentStatus === 'refunded') return { outcome: 'already-settled', ticketRef, status: 'refunded' }
      const { seatsReleased } = await deactivateAttendee(ticketRef, 'refunded')
      return { outcome: 'refunded', ticketRef, seatsReleased }
    }

    case 'failed':
      // Nothing changes. The record stays pending and the same person can try
      // again; the reason is logged by the caller for the ops trail only.
      return { outcome: 'failed', ticketRef, reason: event.reason }
  }
}
