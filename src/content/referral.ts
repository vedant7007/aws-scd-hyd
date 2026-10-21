/**
 * The referral leaderboard. Anyone whose registration reached the payment
 * receipt gets a code; every person who registers with that code is one
 * point, a group of five is five. Rejected or deleted registrations drop
 * out on their own, because the count is read from the live records.
 */

/** Counting stops at the end of 24 October 2026, IST. Later registrations still go through; they just do not count. */
export const REFERRAL_CUTOFF = '2026-10-24T18:29:59.999Z'
export const REFERRAL_CUTOFF_LABEL = '24 October, 11:59 PM'

export const referralOpen = (at = new Date().toISOString()) => at <= REFERRAL_CUTOFF

/** The share link people send around. /r/CODE lands on registration with the code filled in. */
export const referralPath = (code: string) => `/r/${code}`

/**
 * Player card levels on /refer: the frame upgrades as referrals grow. A
 * nudge to keep sharing, not a prize promise; prizes are announced separately.
 */
export const LEVELS = [
  { at: 0, name: 'ROOKIE' },
  { at: 3, name: 'RARE' },
  { at: 10, name: 'EPIC' },
  { at: 25, name: 'LEGEND' },
] as const

export function levelOf(count: number) {
  const i = LEVELS.filter((l) => count >= l.at).length - 1
  const next = LEVELS[i + 1]
  return { level: LEVELS[i]!, next: next ?? null, toNext: next ? next.at - count : 0, progress: next ? (count - LEVELS[i]!.at) / (next.at - LEVELS[i]!.at) : 1 }
}

/** 1ST, 2ND, 3RD, 4TH... 11TH, 12TH, 13TH, 21ST. */
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH')}`

/** Arcade scores are zero padded. */
export const score = (n: number) => String(n).padStart(3, '0')
