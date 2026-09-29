/**
 * Manual payment by UPI, as the v3 flow draws it. The student scans a QR
 * the page generates for the exact amount, with their pass id in the note,
 * pays from their own app, then comes back with the UTR and a screenshot.
 *
 * The QR is built from these two values, so there is no image to ship.
 *
 * Both come from the server environment, never from this file: the repo is
 * public and the account may be a person's own number. The id is never
 * printed on a page or sent in an API response, only encoded in the QR and
 * the one-tap app link. Set SCD_UPI_ID (and optionally SCD_UPI_PAYEE) in
 * .env.local and on the Amplify app.
 *
 * TODO(vedant): the id in use is a temporary one for testing; swap in the
 * permanent account before launch.
 */
export const payment = {
  /** Registration cannot open while this is unset: the launch guard refuses. */
  upiId: process.env.SCD_UPI_ID?.trim() || null,
  /** The name printed beside the QR and sent as pn. Unset means neither: the student's app shows the account's own name. */
  payeeName: process.env.SCD_UPI_PAYEE?.trim() || null,
}

/**
 * The link a UPI app opens: payee, name, the exact amount in rupees, INR,
 * and the pass id as the note so the bank statement row can be matched to
 * the record by eye.
 */
export function upiLink(upiId: string, amountPaise: number, passId: string): string {
  // encodeURIComponent, not URLSearchParams: some UPI apps print a '+' for a space literally.
  const q = { pa: upiId, ...(payment.payeeName ? { pn: payment.payeeName } : {}), am: (amountPaise / 100).toFixed(2), cu: 'INR', tn: passId }
  // '@' stays literal, as every bank's own QR prints it; some apps refuse %40 in pa.
  return `upi://pay?${Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, '@')}`).join('&')}`
}

/**
 * How long a record holds its seats once the student reaches the payment
 * step, before the sweep gives them back. Ninety minutes by the organiser's
 * decision. The sweep runs hourly, so the effective hold is this to this
 * plus sixty minutes; the page counts down the ninety.
 */
export const holdMinutes = 90
