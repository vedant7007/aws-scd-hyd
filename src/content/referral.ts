/**
 * The referral leaderboard. Anyone whose registration reached the payment
 * receipt gets a code; every person who registers with that code is one
 * point, a group of five is five. Rejected or deleted registrations drop
 * out on their own, because the count is read from the live records.
 */

/**
 * Counting stops at the end of 26 October 2026, IST (extended from the 24th
 * with registrations, by the organisers on 24 October). Later registrations
 * still go through; they just do not count.
 */
export const REFERRAL_CUTOFF = '2026-10-26T18:29:59.999Z'
export const REFERRAL_CUTOFF_LABEL = '26 October, 11:59 PM'

export const referralOpen = (at = new Date().toISOString()) => at <= REFERRAL_CUTOFF

/**
 * What the referral leaderboard wins, shown on the site. Decided by the
 * organisers on 25 October 2026. No prices are shown, by their decision.
 * The special prize goes to anyone with SPECIAL_PRIZE_AT or more verified
 * referrals, on top of any top 3 place.
 */
/** Off until the organisers reveal the prizes: the site shows mystery capsules instead. */
export const PRIZES_REVEALED = false
export type Prize = { rank: 1 | 2 | 3; name: string; kind: string; photo: string }
export const PRIZES: Prize[] = [
  { rank: 1, name: 'Noise Airwave Max 4', kind: 'Wireless ENC headphones', photo: '/assets/prizes/headphones.jpg' },
  { rank: 2, name: 'boAt Storm Blaze', kind: 'HD smartwatch with BT calling', photo: '/assets/prizes/watch.jpg' },
  { rank: 3, name: 'Dubstep Pop 1400', kind: '14W Bluetooth speaker', photo: '/assets/prizes/speaker.jpg' },
]
export const SPECIAL_PRIZE_AT = 25
export const SPECIAL_LOOT: { name: string; photo: string }[] = [
  { name: 'Ant Esports NC150 cooling pad', photo: '/assets/prizes/pad.jpg' },
  { name: 'Cosmic Byte wireless controller', photo: '/assets/prizes/controller.jpg' },
  { name: 'Ant Esports GM700 gaming mouse', photo: '/assets/prizes/mouse.jpg' },
  { name: 'Gaming mouse pad', photo: '/assets/prizes/mat.jpg' },
]

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
