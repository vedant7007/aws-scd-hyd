import type { Tier } from '../lib/db/types'

/**
 * What a registration chooses, from the v3 handoff's Registration Flow and
 * CLAUDE_CODE_PROMPT.md section 9. Every pass attends the keynote, one
 * technical session and the Q&A; Premium and above add one hands-on
 * workshop; Platinum and above add the panel.
 *
 * A registration picks its technical session, and its workshop where the
 * pass has one, at step two of the flow. Each is a seat in a room, so each
 * is counted against its own ceiling in the table (SESSION#<id>), set by an
 * admin on the settings page.
 */

export type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Beginner–Intermediate'

export type ProgramSession = {
  /** The stored key: in records, counters and CSV exports. Never renamed once anyone has registered. */
  id: string
  kind: 'technical' | 'workshop'
  /** As the flow prints it: TECH 01, WORKSHOP 02. */
  code: string
  title: string
  level: Level
}

export const technicalSessions: ProgramSession[] = [
  { id: 't1', kind: 'technical', code: 'TECH 01', title: 'Cloud 101: Your Journey into AWS', level: 'Beginner' },
  { id: 't2', kind: 'technical', code: 'TECH 02', title: 'Building on AWS: From Architecture to Deployment', level: 'Intermediate' },
  { id: 't3', kind: 'technical', code: 'TECH 03', title: 'Architecting for Scale: Building Resilient AWS Solutions', level: 'Advanced' },
  { id: 't4', kind: 'technical', code: 'TECH 04', title: 'AI Unleashed: From Machine Learning to Generative AI', level: 'Beginner' },
  { id: 't5', kind: 'technical', code: 'TECH 05', title: 'From LLMs to AI Agents: Building the Next Generation of AI', level: 'Intermediate' },
]

export const workshops: ProgramSession[] = [
  { id: 'w1', kind: 'workshop', code: 'WORKSHOP 01', title: 'Build & Deploy: Your First Application on AWS', level: 'Beginner–Intermediate' },
  { id: 'w2', kind: 'workshop', code: 'WORKSHOP 02', title: 'Build Your First AI Application', level: 'Beginner–Intermediate' },
]

export const programSessions: ProgramSession[] = [...technicalSessions, ...workshops]

export const programSession = (id: string | null | undefined) => (id ? programSessions.find((s) => s.id === id) : undefined)

/** The pass levels, 1 to 4, which decide what a pass includes. */
export const TIER_LEVEL: Record<Tier, number> = { basic: 1, premium: 2, ultra: 3, vip: 4 }

/** Premium and above attend one workshop, and must choose it. */
export const hasWorkshop = (tier: Tier) => TIER_LEVEL[tier] >= 2

/**
 * The event day, for the age gate. Attendees must be 18 or older on this
 * date. The flow checks it as they type and the server checks it again,
 * because the browser's answer is only a courtesy.
 */
export const EVENT_DAY = '2026-10-30'
export const MINIMUM_AGE = 18

/** Whole years old on the event day, or null for a date that is not one. */
export function ageOnEventDay(dateOfBirth: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dob = new Date(Date.UTC(y, mo - 1, d))
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== mo - 1 || dob.getUTCDate() !== d) return null
  const [ey, em, ed] = EVENT_DAY.split('-').map(Number) as [number, number, number]
  let age = ey - y
  if (em < mo || (em === mo && ed < d)) age--
  return age
}

/** Years of study as the flow offers them. Stored as typed. */
export const YEARS = ['1', '2', '3', '4', '5+'] as const
export type Year = (typeof YEARS)[number]
