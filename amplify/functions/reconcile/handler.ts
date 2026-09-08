import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../../../src/lib/db/client'
import { keys } from '../../../src/lib/db/keys'
import { listAttendees } from '../../../src/lib/db/queries'
import type { ReconcileSummary } from '../../../src/lib/db/types'
import { deactivateAttendee, upsertAttendeeFromTicket } from '../../../src/lib/db/writes'
import { getTicketingProvider } from '../../../src/lib/tickets/provider'

/**
 * SPEC.md section 8. Runs hourly.
 *
 * 1. Ask the provider what it thinks it sold.
 * 2. Anything it has that we do not gets inserted, marked source reconcile.
 * 3. Anything we have as paid that it has cancelled gets deactivated and its
 *    seats freed.
 * 4. Write a summary so the dashboard can show the last run and the mismatch
 *    count, because a reconciliation nobody looks at is not a safety net.
 *
 * The confirmation email for an inserted record is deliberately not sent yet:
 * SES is sandboxed and the domain is not attached, SPEC.md section 15.
 */
export const handler = async (): Promise<ReconcileSummary> => {
  const ranAt = new Date().toISOString()
  const providerName = process.env.TICKETING_PROVIDER ?? 'mock'

  const summary: ReconcileSummary = {
    ...keys.reconcile(),
    ranAt,
    provider: providerName,
    checked: 0,
    inserted: 0,
    deactivated: 0,
    mismatches: 0,
    ok: true,
  }

  try {
    const provider = getTicketingProvider()
    const [theirs, ours] = await Promise.all([provider.listAll(), listAttendees()])

    summary.checked = theirs.length

    const ourByRef = new Map(ours.map((a) => [a.ticketRef, a]))
    const theirByRef = new Map(theirs.map((t) => [t.ticketRef, t]))

    // Present at the provider, missing here. This is the case that matters:
    // a student with a real ticket and no record.
    for (const ticket of theirs) {
      if (ticket.type !== 'registered') continue
      const existing = ourByRef.get(ticket.ticketRef)
      if (existing) continue

      const { created } = await upsertAttendeeFromTicket(ticket)
      if (created) {
        summary.inserted++
        summary.mismatches++
        console.info(`[reconcile] inserted ${ticket.ticketRef} that was missing locally`)
        // TODO(phase 4): send the confirmation email once SES is out of sandbox.
      }
    }

    // Paid here, cancelled or absent at the provider.
    for (const attendee of ours) {
      if (attendee.paymentStatus !== 'paid') continue
      const theirTicket = theirByRef.get(attendee.ticketRef)
      if (theirTicket && theirTicket.type === 'registered') continue
      if (!theirTicket) continue // Not sold by this provider, leave manual records alone.

      await deactivateAttendee(attendee.ticketRef, theirTicket.type === 'refunded' ? 'refunded' : 'cancelled')
      summary.deactivated++
      summary.mismatches++
      console.info(`[reconcile] deactivated ${attendee.ticketRef}, provider says ${theirTicket.type}`)
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
    `[reconcile] checked ${summary.checked}, inserted ${summary.inserted}, deactivated ${summary.deactivated}`,
  )
  return summary
}
