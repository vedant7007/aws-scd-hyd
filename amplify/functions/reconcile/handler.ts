import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../../../src/lib/db/client'
import { keys } from '../../../src/lib/db/keys'
import { listAttendees } from '../../../src/lib/db/queries'
import type { ReconcileSummary } from '../../../src/lib/db/types'
import { isReservedAddress, sendEmail } from '../../../src/lib/email/send'
import { confirmation } from '../../../src/lib/email/templates'
import { sweepAbandoned } from '../../../src/lib/registration/flow'
import { markSent } from '../../../src/lib/registration/state'
import { paymentMode } from '../../../src/lib/tickets/mode'
import { listSettled } from '../../../src/lib/tickets/razorpay'
import { settle } from '../../../src/lib/tickets/settle'

/**
 * Runs hourly. Amendment 1 section 2.3 reuses this schedule for the sweep.
 *
 * 1. The sweep: every AWAITING_PAYMENT record whose hold has lapsed goes to
 *    ABANDONED and gives its track place back, each in one transaction.
 * 2. Razorpay mode only: ask the provider what settled in the window and
 *    apply every event through settle(), which is idempotent.
 * 3. Anyone VERIFIED who has never been sent email 2 gets it now, which
 *    covers a verify whose SES call failed after the record moved.
 * 4. Write a summary so the dashboard shows the last run.
 *
 * A send failure never fails the run.
 */

/** Wide enough that a payment made just before a long outage is still found. */
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export const handler = async (): Promise<ReconcileSummary> => {
  const ranAt = new Date().toISOString()
  const mode = paymentMode()

  const summary: ReconcileSummary = {
    ...keys.reconcile(),
    ranAt,
    provider: mode,
    checked: 0,
    inserted: 0,
    deactivated: 0,
    emailed: 0,
    mismatches: 0,
    abandoned: 0,
    ok: true,
  }

  try {
    const swept = await sweepAbandoned(ranAt)
    summary.abandoned = swept.abandoned
    if (swept.abandoned) console.info(`[reconcile] abandoned ${swept.abandoned} of ${swept.checked} lapsed registration(s)`)

    if (mode === 'razorpay') {
      const events = await listSettled(new Date(Date.now() - WINDOW_MS))
      summary.checked = events.length
      for (const event of events) {
        const result = await settle(event)
        switch (result.outcome) {
          case 'paid':
            summary.inserted++
            summary.mismatches++
            if (result.emailed) summary.emailed++
            console.info(`[reconcile] ${result.passId} was awaiting, provider says paid, applied`)
            break
          case 'refunded':
            summary.deactivated++
            summary.mismatches++
            console.info(`[reconcile] ${result.passId} refunded at provider, released ${result.seatsReleased} seat(s)`)
            break
          case 'amount-mismatch':
            summary.mismatches++
            console.error(`[reconcile] ${result.passId} amount mismatch, expected ${result.expected}, paid ${result.got}, NOT applied`)
            break
          case 'unknown-order':
            summary.mismatches++
            console.warn(`[reconcile] provider has order ${result.orderId} with no record here`)
            break
          default:
            break
        }
      }
    }

    // Owed confirmations. Seeded attendees carry reserved addresses and are
    // skipped rather than retried forever.
    for (const attendee of await listAttendees()) {
      if (attendee.state !== 'VERIFIED' || attendee.confirmationSentAt) continue
      if (isReservedAddress(attendee.email)) continue
      try {
        await sendEmail({ to: attendee.email, ...confirmation(attendee) })
        await markSent(attendee.passId, 'confirmationSentAt')
        summary.emailed++
        console.info(`[reconcile] confirmation sent to ${attendee.passId}`)
      } catch (err) {
        console.error('[reconcile] confirmation email failed, will retry next run', { passId: attendee.passId, err })
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
    `[reconcile] abandoned ${summary.abandoned}, checked ${summary.checked}, applied ${summary.inserted}, deactivated ${summary.deactivated}, emailed ${summary.emailed}`,
  )
  return summary
}
