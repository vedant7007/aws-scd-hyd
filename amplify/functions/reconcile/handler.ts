import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../../../src/lib/db/client'
import { keys } from '../../../src/lib/db/keys'
import { listAttendees } from '../../../src/lib/db/queries'
import type { PaidAttendee, ReconcileSummary } from '../../../src/lib/db/types'
import { markConfirmationSent } from '../../../src/lib/db/writes'
import { isReservedAddress, sendEmail } from '../../../src/lib/email/send'
import { confirmation } from '../../../src/lib/email/templates'
import { listSettled } from '../../../src/lib/tickets/razorpay'
import { settle } from '../../../src/lib/tickets/settle'

/**
 * SPEC.md section 8. Runs hourly.
 *
 * 1. Ask the provider what settled in the window: captured payments and
 *    processed refunds, as the same events the webhook would have carried.
 * 2. Apply every one through settle(), which is idempotent. Anything that was
 *    still pending here is a webhook that never arrived; it is now paid and
 *    the confirmation goes out. Anything refunded there is released here.
 * 3. Anyone paid who has never been sent a confirmation gets one now, which
 *    covers a webhook whose SES call failed after the record was written.
 * 4. Write a summary so the dashboard can show the last run and the mismatch
 *    count, because a reconciliation nobody looks at is not a safety net.
 *
 * A send failure never fails the run.
 */

/** Wide enough that a payment made just before a long outage is still found. */
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export const handler = async (): Promise<ReconcileSummary> => {
  const ranAt = new Date().toISOString()

  const summary: ReconcileSummary = {
    ...keys.reconcile(),
    ranAt,
    provider: 'razorpay',
    checked: 0,
    inserted: 0,
    deactivated: 0,
    emailed: 0,
    mismatches: 0,
    ok: true,
  }

  try {
    const events = await listSettled(new Date(Date.now() - WINDOW_MS))
    summary.checked = events.length

    for (const event of events) {
      const result = await settle(event)
      switch (result.outcome) {
        case 'paid':
          // The webhook should have done this. That it did not is the mismatch.
          summary.inserted++
          summary.mismatches++
          if (result.emailed) summary.emailed++
          console.info(`[reconcile] ${result.ticketRef} was pending, provider says paid, applied`)
          break
        case 'refunded':
          summary.deactivated++
          summary.mismatches++
          console.info(`[reconcile] ${result.ticketRef} refunded at provider, released ${result.seatsReleased} seat(s)`)
          break
        case 'amount-mismatch':
          summary.mismatches++
          console.error(`[reconcile] ${result.ticketRef} amount mismatch, order ${result.expected}, paid ${result.got}, NOT applied`)
          break
        case 'unknown-order':
          // An order on the account that this table never created. Test mode
          // noise, or a dashboard created order. Counted so it is visible.
          summary.mismatches++
          console.warn(`[reconcile] provider has order ${result.orderId} with no record here`)
          break
        default:
          // already-settled, partial-refund, failed: nothing to do.
          break
      }
    }

    // Owed confirmations. Seeded attendees carry reserved addresses and are
    // skipped rather than retried forever.
    for (const attendee of await listAttendees()) {
      if (attendee.paymentStatus !== 'paid' || attendee.confirmationSentAt || !attendee.passToken) continue
      if (isReservedAddress(attendee.email)) continue
      try {
        await sendEmail({ to: attendee.email, ...confirmation(attendee as PaidAttendee) })
        await markConfirmationSent(attendee.ticketRef)
        summary.emailed++
        console.info(`[reconcile] confirmation sent to ${attendee.ticketRef}`)
      } catch (err) {
        console.error('[reconcile] confirmation email failed, will retry next run', { ticketRef: attendee.ticketRef, err })
      }
    }
  } catch (err) {
    summary.ok = false
    summary.error = err instanceof Error ? err.message : String(err)
    console.error('[reconcile] run failed', err)
  }

  // Always record the run, including a failed one, so silence on the dashboard
  // means "never ran" rather than "ran and broke".
  await ddb.send(new PutCommand({ TableName: tableName(), Item: summary }))

  console.info(
    `[reconcile] checked ${summary.checked}, applied ${summary.inserted}, deactivated ${summary.deactivated}, emailed ${summary.emailed}`,
  )
  return summary
}
