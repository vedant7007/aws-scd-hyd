/**
 * Why a payment is rejected, by the organiser's decision. The admin picks
 * one; the wording goes into the record and the rejection email as it
 * stands here. "Other" carries a free-text note.
 */
export const REJECTION_REASONS = {
  'not-found': 'Could not find this payment',
  amount: 'Amount does not match',
  used: 'This payment has already been used for another registration',
  other: 'Other',
} as const

export type RejectionCode = keyof typeof REJECTION_REASONS

export const rejectionCodes = Object.keys(REJECTION_REASONS) as RejectionCode[]

/** The stored and emailed text for a code, with the note where the code needs one. Null when the input is not usable. */
export function rejectionText(code: string, note: string): string | null {
  if (!(code in REJECTION_REASONS)) return null
  const clean = note.trim().slice(0, 300)
  if (code === 'other') return clean ? clean : null
  return clean ? `${REJECTION_REASONS[code as RejectionCode]}. ${clean}` : REJECTION_REASONS[code as RejectionCode]
}

/** The word an admin has to type to close registration. Closing by accident mid-promotion is expensive. */
export const CONFIRM_CLOSE = 'CLOSE'
