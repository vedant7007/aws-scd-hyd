import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../../../src/lib/db/client'
import { keys } from '../../../src/lib/db/keys'
import { listAttendees } from '../../../src/lib/db/queries'
import type { ReconcileSummary } from '../../../src/lib/db/types'
import { isReservedAddress, sendEmail } from '../../../src/lib/email/send'
import { confirmation } from '../../../src/lib/email/templates'
import { sweepAbandoned } from '../../../src/lib/registration/flow'
import { markSent } from '../../../src/lib/registration/state'

/**
 * Runs hourly.
 *
 * 1. The sweep: every AWAITING_PAYMENT record whose ninety minute hold has
 *    lapsed goes to ABANDONED and gives its session seats back, each in one
 *    transaction.
 * 2. Anyone VERIFIED who has never been sent email 2, the ticket, gets it
 *    now, which covers a verify whose SES call failed after the record moved.
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

    // Owed tickets. Seeded attendees carry reserved addresses and are
    // skipped rather than retried forever.
    for (const attendee of await listAttendees()) {
      if (attendee.state !== 'VERIFIED' || attendee.confirmationSentAt) continue
      if (isReservedAddress(attendee.email)) continue
      try {
        await sendEmail({ to: attendee.email, ...confirmation(attendee) })
        await markSent(attendee.passId, 'confirmationSentAt')
        summary.emailed++
        console.info(`[reconcile] ticket sent to ${attendee.passId}`)
      } catch (err) {
        console.error('[reconcile] ticket email failed, will retry next run', { passId: attendee.passId, err })
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
