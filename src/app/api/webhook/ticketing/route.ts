import { deactivateAttendee, upsertAttendeeFromTicket } from '@/lib/db/writes'
import { getTicketingProvider } from '@/lib/tickets/provider'

/**
 * SPEC.md section 8.
 *
 * The provider verifies the signature against the raw body before anything is
 * parsed. An unverified request gets a 401 and its body is never read into a
 * log, because an unverified body is attacker controlled input.
 *
 * A verified request always gets a 200, even when applying it fails. A non-200
 * makes the provider retry forever, and the retry would hit the same failure.
 */
export async function POST(req: Request): Promise<Response> {
  const provider = getTicketingProvider()

  let event
  try {
    event = await provider.verifyAndParse(req)
  } catch {
    event = null
  }

  if (!event) {
    // Deliberately no body, no headers, no payload in this log line.
    console.warn('[webhook] rejected an unverified or unparseable request')
    return new Response('unauthorized', { status: 401 })
  }

  try {
    if (event.type === 'registered') {
      const { created } = await upsertAttendeeFromTicket(event)
      console.info(`[webhook] ${event.ticketRef} ${created ? 'created' : 'already existed, updated'}`)
      // TODO(phase 3): on created, send the confirmation email carrying the
      // pass link via SES. Blocked on SES production access, SPEC.md section 15.
    } else {
      const { seatsReleased } = await deactivateAttendee(event.ticketRef, event.type)
      console.info(`[webhook] ${event.ticketRef} ${event.type}, released ${seatsReleased} seat(s)`)
    }
  } catch (err) {
    console.error('[webhook] failed to apply a verified event', {
      ticketRef: event.ticketRef,
      type: event.type,
      err,
    })
  }

  return new Response('ok', { status: 200 })
}
