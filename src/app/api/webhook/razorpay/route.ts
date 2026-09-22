import { verifyAndParse } from '@/lib/tickets/razorpay'
import { settle } from '@/lib/tickets/settle'

/**
 * SPEC.md section 8. The only thing that moves a record from pending to paid.
 *
 * The signature is checked against the raw body before anything is parsed. An
 * unverified request gets a 401 and its body is never read into a log, because
 * an unverified body is attacker controlled input.
 *
 * A verified request always gets a 200, even when applying it fails. A non-200
 * makes Razorpay retry for a day, and the retry would hit the same failure;
 * the hourly reconcile run is the retry that can actually help.
 */
export async function POST(req: Request): Promise<Response> {
  let event
  try {
    event = await verifyAndParse(req)
  } catch {
    event = null
  }

  if (!event) {
    // Deliberately no body, no headers, no payload in this log line.
    console.warn('[webhook:razorpay] rejected an unverified or unrecognised request')
    return new Response('unauthorized', { status: 401 })
  }

  try {
    const result = await settle(event)
    switch (result.outcome) {
      case 'paid':
        console.info(`[webhook:razorpay] ${result.passId} paid, confirmation ${result.emailed ? 'sent' : 'owed'}`)
        break
      case 'already-settled':
        console.info(`[webhook:razorpay] ${result.passId} replay ignored, already ${result.state}`)
        break
      case 'amount-mismatch':
        console.error(`[webhook:razorpay] ${result.passId} NOT marked paid: order was ${result.expected} paise, payment ${result.got}`)
        break
      case 'refunded':
        console.info(`[webhook:razorpay] ${result.passId} refunded, released ${result.seatsReleased} seat(s)`)
        break
      case 'partial-refund':
        console.warn(`[webhook:razorpay] ${result.passId} partial refund, record left as is`)
        break
      case 'failed':
        console.info(`[webhook:razorpay] ${result.passId} payment failed (${result.reason}), left pending`)
        break
      case 'unknown-order':
        console.warn(`[webhook:razorpay] no record for order ${result.orderId}`)
        break
    }
  } catch (err) {
    console.error('[webhook:razorpay] failed to apply a verified event', { type: event.type, orderId: event.orderId, err })
  }

  return new Response('ok', { status: 200 })
}
