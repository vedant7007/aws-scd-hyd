import type { PaymentMode } from '../db/types'

/**
 * Which way money moves. Manual (UPI, UTR, admin verification) is the
 * default and what the site is built around; Razorpay is kept intact behind
 * this switch because the college QR route depends on the college sharing
 * bank statements, which is not yet guaranteed. Both end in the same
 * VERIFIED state through the same transition.
 */
export function paymentMode(): PaymentMode {
  return process.env.PAYMENT_MODE === 'razorpay' ? 'razorpay' : 'manual'
}
