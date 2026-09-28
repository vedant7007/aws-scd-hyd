/**
 * Manual payment by UPI, as the v3 flow draws it. The student scans a QR
 * the page generates for the exact amount, with their pass id in the note,
 * pays from their own app, then comes back with the UTR and a screenshot.
 *
 * The QR is built from these two values, so there is no image to ship.
 */
export const payment = {
  /** TODO(vedant): the college account's UPI id. Registration cannot open while this is null: the launch guard refuses. */
  upiId: null as string | null,
  /** TODO(vedant): the payee name the student's UPI app will show. Confirm against the college account. */
  payeeName: 'Vidya Jyothi Institute of Technology',
} as const

/**
 * The link a UPI app opens: payee, name, the exact amount in rupees, INR,
 * and the pass id as the note so the bank statement row can be matched to
 * the record by eye.
 */
export function upiLink(upiId: string, amountPaise: number, passId: string): string {
  // encodeURIComponent, not URLSearchParams: some UPI apps print a '+' for a space literally.
  const q = { pa: upiId, pn: payment.payeeName, am: (amountPaise / 100).toFixed(2), cu: 'INR', tn: passId }
  return `upi://pay?${Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
}

/**
 * How long a record holds its seats once the student reaches the payment
 * step, before the sweep gives them back. Ninety minutes by the organiser's
 * decision. The sweep runs hourly, so the effective hold is this to this
 * plus sixty minutes; the page counts down the ninety.
 */
export const holdMinutes = 90
