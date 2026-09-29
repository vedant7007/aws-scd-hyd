import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../../../src/lib/db/client'
import { keys } from '../../../src/lib/db/keys'
import { listAttendees } from '../../../src/lib/db/queries'
import type { ReconcileSummary } from '../../../src/lib/db/types'
import { isReservedAddress, sendEmail } from '../../../src/lib/email/send'
import { confirmation, receipt } from '../../../src/lib/email/templates'
import { sweepAbandoned } from '../../../src/lib/registration/flow'
import { markSent } from '../../../src/lib/registration/state'

/**
 * Runs every five minutes.
 *
 * 1. The sweep: every AWAITING_PAYMENT record whose twenty minute hold has
 *    lapsed goes to ABANDONED and gives its session seats back, each in one
 *    transaction.
 * 2. Owed mail: a pending registration whose receipt never went, and a
 *    verified one whose payment-verified mail never went, get it now.
 * 3. Write a summary so the dashboard shows the last run.
 *
 * A send failure never fails the run.
 */
export const handler = async (): Promise<ReconcileSummary> => {
  const ranAt = new Date().toISOString()
  const summary: ReconcileSummary = { ...keys.reconcile(), ranAt, emailed: 0, abandoned: 0, ok: true }

  try {
    const swept = await sweepAbandoned(ranAt)
    summary.abandoned = swept.abandoned
    if (swept.abandoned) console.info(`[reconcile] abandoned ${swept.abandoned} of ${swept.checked} lapsed hold(s)`)

    // Owed mail: a receipt that never went (say SES throttled a burst of
    // submissions), and a payment-verified mail that never went. Seeded
    // attendees carry reserved addresses and are skipped rather than retried
    // forever.
    for (const attendee of await listAttendees()) {
      if (isReservedAddress(attendee.email)) continue
      if (attendee.state === 'PENDING_VERIFICATION' && !attendee.receiptSentAt) {
        try {
          await sendEmail({ to: attendee.email, ...receipt(attendee) })
          await markSent(attendee.passId, 'receiptSentAt')
          summary.emailed++
          console.info(`[reconcile] receipt sent to ${attendee.passId}`)
        } catch (err) {
          console.error('[reconcile] receipt failed, will retry next run', { passId: attendee.passId, err })
        }
        continue
      }
      if (attendee.state !== 'VERIFIED' || attendee.confirmationSentAt) continue
      try {
        await sendEmail({ to: attendee.email, ...confirmation(attendee) })
        await markSent(attendee.passId, 'confirmationSentAt')
        summary.emailed++
        console.info(`[reconcile] payment verified mail sent to ${attendee.passId}`)
      } catch (err) {
        console.error('[reconcile] payment verified mail failed, will retry next run', { passId: attendee.passId, err })
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
  console.info(`[reconcile] abandoned ${summary.abandoned}, emailed ${summary.emailed}`)
  return summary
}
