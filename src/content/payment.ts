/**
 * Manual payment by UPI, as the v3 flow draws it. The student scans a QR
 * the page generates for the exact amount, with their pass id in the note,
 * pays from their own app, then comes back with the UTR and a screenshot.
 *
 * Two accounts, both from the server environment and never from this file,
 * because the repo is public:
 *
 *   live  SCD_UPI_ID, SCD_UPI_PAYEE, SCD_UPI_MC: the college account, read
 *         from the college's own merchant QR. Every real registration.
 *   test  SCD_UPI_TEST_ID: the organiser's own account. Only records made
 *         at /register/preview pay here, for testing end to end with real
 *         money before the college account takes it.
 *
 * The id is never printed on a page or sent in an API response, only
 * encoded in the QR and the one-tap app link.
 */
export type UpiAccount = { upiId: string; payeeName: string | null; merchantCode: string | null }

const env = (k: string) => process.env[k]?.trim() || null

export const payment = {
  /** Registration cannot open while this is unset: the launch guard refuses. */
  live: env('SCD_UPI_ID') ? ({ upiId: env('SCD_UPI_ID')!, payeeName: env('SCD_UPI_PAYEE'), merchantCode: env('SCD_UPI_MC') } as UpiAccount) : null,
  test: env('SCD_UPI_TEST_ID') ? ({ upiId: env('SCD_UPI_TEST_ID')!, payeeName: null, merchantCode: null } as UpiAccount) : null,
}

/** The account a record pays: the test one for preview records while it is set, the college one otherwise. */
export const accountFor = (source: string): UpiAccount | null => (source === 'preview' ? (payment.test ?? payment.live) : payment.live)

/**
 * The link a UPI app opens: payee, name, merchant code where the bank's QR
 * carries one, the exact amount in rupees, INR, and the pass id as the note
 * so the bank statement row can be matched to the record by eye.
 */
export function upiLink(account: UpiAccount, amountPaise: number, passId: string): string {
  const q: Record<string, string> = { pa: account.upiId }
  if (account.payeeName) q.pn = account.payeeName
  if (account.merchantCode) q.mc = account.merchantCode
  Object.assign(q, { am: (amountPaise / 100).toFixed(2), cu: 'INR', tn: passId })
  // encodeURIComponent, not URLSearchParams: some UPI apps print a '+' for a
  // space literally. '@' stays literal, as every bank's own QR prints it.
  return `upi://pay?${Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, '@')}`).join('&')}`
}

/**
 * How long a record holds its seats once the student reaches the payment
 * step, before the sweep gives them back. Ninety minutes by the organiser's
 * decision. The sweep runs hourly, so the effective hold is this to this
 * plus sixty minutes; the page counts down the ninety.
 */
export const holdMinutes = 90
