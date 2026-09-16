import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Razorpay, and nothing about Razorpay anywhere else. SPEC.md section 8.
 *
 * Three things cross this boundary: an order is created before the browser
 * opens Checkout, a webhook is verified and reduced to a PaymentEvent, and the
 * reconcile run asks what settled in a window. The REST API is plain enough
 * that the SDK would add a dependency to save a fetch call, so it is not used.
 */

const API = 'https://api.razorpay.com/v1'
export const SIGNATURE_HEADER = 'x-razorpay-signature'

/** What the rest of the system needs to know about a payment. Provider free. */
export type PaymentEvent =
  | { type: 'captured'; orderId: string; paymentId: string; amountPaise: number }
  | { type: 'refunded'; orderId: string; paymentId: string; amountPaise: number; full: boolean }
  | { type: 'failed'; orderId: string; paymentId: string; reason: string }

export type Order = {
  orderId: string
  amountPaise: number
  currency: 'INR'
  /** The publishable key the browser needs. Not a secret, but read from env like one. */
  keyId: string
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set and Razorpay cannot be used without it.`)
  return value
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Razorpay rate limits order creation and answers a burst with 429. A campus
 * registering at once is a burst, so a 429 or a 5xx is retried a few times
 * with backoff before it becomes the visitor's problem. Creating an order is
 * safe to retry: a duplicate is an unpaid order nobody can reach.
 */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = Buffer.from(`${required('RAZORPAY_KEY_ID')}:${required('RAZORPAY_KEY_SECRET')}`).toString('base64')
  const attempts = 4
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json', ...init?.headers },
    })
    if (res.ok) return (await res.json()) as T

    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < attempts) {
      const hinted = Number(res.headers.get('retry-after')) * 1000
      await sleep(hinted > 0 ? hinted : 300 * attempt + Math.random() * 300)
      continue
    }
    // The error body names the field, never the key. Safe to surface.
    const detail = await res.text().catch(() => '')
    throw new Error(`Razorpay ${init?.method ?? 'GET'} ${path} failed with ${res.status} after ${attempt} attempt(s): ${detail.slice(0, 300)}`)
  }
}

type RzpPayment = {
  id: string
  order_id: string | null
  amount: number
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  amount_refunded?: number
  error_code?: string | null
  error_reason?: string | null
}

type RzpOrder = {
  id: string
  amount: number
  status: 'created' | 'attempted' | 'paid'
  receipt?: string | null
  payments?: { items: RzpPayment[] }
}

type RzpRefund = { id: string; payment_id: string; amount: number; status: 'pending' | 'processed' | 'failed' }

type RzpCollection<T> = { count: number; items: T[] }

/**
 * The amount is whatever the caller computed from content. The receipt is our
 * ticket reference, so an order is traceable from the Razorpay dashboard even
 * if this table were lost.
 */
export async function createOrder(input: { ticketRef: string; amountPaise: number; tier: string }): Promise<Order> {
  const order = await api<RzpOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.ticketRef,
      notes: { ticketRef: input.ticketRef, tier: input.tier },
    }),
  })
  return { orderId: order.id, amountPaise: order.amount, currency: 'INR', keyId: required('RAZORPAY_KEY_ID') }
}

/**
 * Constant time compare of the hex HMAC-SHA256 that Razorpay puts in
 * X-Razorpay-Signature, computed over the raw body with the webhook secret.
 * Returns false rather than throwing on a length mismatch, because
 * timingSafeEqual requires equal lengths. The secret is read and never logged.
 */
function signatureMatches(rawBody: string, provided: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !provided) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'))
  const actual = Buffer.from(provided.trim())
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

/** Exported for the local test harness only, so it signs the way Razorpay does. */
export const signForTest = (rawBody: string, secret: string) =>
  createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')

type RzpWebhook = {
  event?: string
  payload?: {
    payment?: { entity?: RzpPayment }
    refund?: { entity?: RzpRefund }
  }
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/**
 * Verify against the raw body BEFORE parsing, SPEC.md section 7. Null for
 * anything unverified or not understood, and the caller logs nothing about it.
 * payment.captured is the only event that moves money into a pass; failed and
 * refunded are carried through so the record can be left alone or released.
 */
export async function verifyAndParse(req: Request): Promise<PaymentEvent | null> {
  const raw = await req.text()
  if (!signatureMatches(raw, req.headers.get(SIGNATURE_HEADER))) return null

  let body: RzpWebhook
  try {
    body = JSON.parse(raw) as RzpWebhook
  } catch {
    return null
  }

  const payment = body.payload?.payment?.entity
  if (!payment || !isString(payment.id) || !isString(payment.order_id)) return null
  const orderId = payment.order_id

  switch (body.event) {
    case 'payment.captured':
      if (!Number.isInteger(payment.amount)) return null
      return { type: 'captured', orderId, paymentId: payment.id, amountPaise: payment.amount }
    case 'payment.failed':
      return { type: 'failed', orderId, paymentId: payment.id, reason: payment.error_code ?? 'unknown' }
    case 'refund.processed': {
      const refund = body.payload?.refund?.entity
      if (!refund || !Number.isInteger(refund.amount)) return null
      return {
        type: 'refunded',
        orderId,
        paymentId: payment.id,
        amountPaise: refund.amount,
        full: refund.amount >= payment.amount,
      }
    }
    default:
      return null
  }
}

/** Walks a paginated collection. Razorpay caps count at 100 per page. */
async function listAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = []
  for (let skip = 0; ; skip += 100) {
    const qs = new URLSearchParams({ ...params, count: '100', skip: String(skip) })
    const page = await api<RzpCollection<T>>(`${path}?${qs}`)
    out.push(...page.items)
    if (page.items.length < 100) return out
  }
}

/**
 * Everything that settled since `from`, as the same events the webhook would
 * have delivered, so the reconcile run applies them through the same code.
 * Orders come back with their payments expanded, which is one call per
 * hundred orders rather than one per order.
 */
export async function listSettled(from: Date): Promise<PaymentEvent[]> {
  const since = String(Math.floor(from.getTime() / 1000))
  const orders = await listAll<RzpOrder>('/orders', { from: since, 'expand[]': 'payments' })

  const events: PaymentEvent[] = []
  const orderOfPayment = new Map<string, string>()

  for (const order of orders) {
    for (const p of order.payments?.items ?? []) orderOfPayment.set(p.id, order.id)
    if (order.status !== 'paid') continue
    const captured = order.payments?.items.find((p) => p.status === 'captured' || p.status === 'refunded')
    if (!captured) continue
    events.push({ type: 'captured', orderId: order.id, paymentId: captured.id, amountPaise: captured.amount })
  }

  const refunds = await listAll<RzpRefund>('/refunds', { from: since })
  for (const refund of refunds) {
    if (refund.status !== 'processed') continue
    // A refund can be for a payment older than the window. One extra call, rarely.
    const payment =
      orderOfPayment.has(refund.payment_id)
        ? { order_id: orderOfPayment.get(refund.payment_id)!, amount: NaN }
        : await api<RzpPayment>(`/payments/${refund.payment_id}`)
    if (!payment.order_id) continue
    const total = Number.isNaN(payment.amount)
      ? orders.find((o) => o.id === payment.order_id)?.amount ?? refund.amount
      : payment.amount
    events.push({
      type: 'refunded',
      orderId: payment.order_id,
      paymentId: refund.payment_id,
      amountPaise: refund.amount,
      full: refund.amount >= total,
    })
  }

  return events
}
