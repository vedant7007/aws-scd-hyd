/**
 * Manual payment by UPI. Amendment 1 section 2. The student pays the
 * college's UPI QR from their own app, quoting their pass id in the note,
 * then comes back and submits the UTR and a screenshot.
 */
export const payment = {
  /** The college's UPI QR, in public/. TODO(vedant): the image is not in the repo yet; the launch guard blocks until it is. */
  qrAssetPath: '/assets/upi-qr.png',
  /** TODO(vedant): the UPI id behind the QR, for a "copy" fallback when a camera cannot read the screen. Null hides the fallback. */
  upiId: null as string | null,
  /** Who the student will see as the payee in their app. TODO(vedant): confirm against the college account. */
  payeeName: 'Vidya Jyothi Institute of Technology',
} as const

/**
 * Amendment 1 section 2.3. How long an AWAITING_PAYMENT record keeps its
 * place against the track counter before the sweep abandons it. Ninety
 * minutes by the organiser's decision. The sweep runs hourly, so the
 * effective hold is this to this plus sixty minutes.
 */
export const holdMinutes = 90
