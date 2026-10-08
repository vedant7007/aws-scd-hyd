import { MINIMUM_AGE, YEARS, ageOnEventDay, hasWorkshop, technicalSessions, workshops, type Year } from '../../content/program'
import { normaliseBuilderId } from '../../content/builder'
import { GROUP_MAX, GROUP_MIN } from '../../content/groups'
import { tierIds } from '../../content/passes'
import type { Tier } from '../db/types'

/**
 * The server's own reading of the flow's form. The flow checks all of this
 * as the student types; none of that counts here. Every rule the handoff
 * names is enforced again: price by tier (decided later, never read from
 * the body), workshop only on Premium and above, 18 or older on the event
 * day, and nothing in the body that is not a field.
 */

export type HoldInput = {
  tier: Tier
  technicalSession: string
  workshop?: string
  firstName: string
  middleName?: string
  lastName: string
  email: string
  phone: string
  college: string
  branch: string
  rollNumber: string
  yearOfStudy: Year
  dateOfBirth: string
  builderId: string
}

export type Invalid = { field: string; message: string }

const FIELDS = [
  'tier',
  'technicalSession',
  'workshop',
  'firstName',
  'middleName',
  'lastName',
  'email',
  'phone',
  'college',
  'branch',
  'rollNumber',
  'yearOfStudy',
  'dateOfBirth',
  'builderId',
  'submissionKey',
  'passId',
] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SUBMISSION_KEY = /^[A-Za-z0-9_-]{16,64}$/

/** Ten digits, as the flow asks, with a +91 or leading 0 tolerated. Stored as +91XXXXXXXXXX. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '')
  const m = /^(?:\+?91|0)?(\d{10})$/.exec(digits)
  return m ? `+91${m[1]}` : null
}

/** A UTR as the flow takes it: letters and digits, 12 to 40, spaces dropped, uppercased. */
export function normaliseUtr(raw: string): string | null {
  const v = raw.replace(/\s+/g, '').toUpperCase()
  return /^[0-9A-Z]{12,40}$/.test(v) ? v : null
}

/** A person as the hold needs them: everything but the tier, which the group shares. */
export type PersonInput = Omit<HoldInput, 'tier'>

const PERSON_FIELDS = FIELDS.filter((f) => f !== 'tier' && f !== 'submissionKey' && f !== 'passId')

/**
 * One person's sessions and details, read from `b`. Error fields are the
 * flow's own names, prefixed with `prefix` (m2. for the third person in a
 * group), so the flow can put the message under the right box.
 */
function readPerson(b: Record<string, unknown>, tier: Tier, prefix = ''): { person: PersonInput } | { error: Invalid } {
  const bad = (field: string, message: string) => ({ error: { field: prefix + field, message } })
  const str = (k: string, min: number, max: number): string | null => {
    const v = b[k]
    if (typeof v !== 'string') return null
    const t = v.trim().replace(/\s+/g, ' ')
    return t.length >= min && t.length <= max ? t : null
  }

  const technicalSession = b.technicalSession
  if (typeof technicalSession !== 'string' || !technicalSessions.some((s) => s.id === technicalSession)) {
    return bad('tech', 'Choose the technical session to attend.')
  }

  let workshop: string | undefined
  if (hasWorkshop(tier)) {
    if (typeof b.workshop !== 'string' || !workshops.some((s) => s.id === b.workshop)) return bad('workshop', 'Choose the hands-on workshop to attend.')
    workshop = b.workshop
  } else if (b.workshop !== undefined && b.workshop !== '' && b.workshop !== null) {
    return bad('workshop', 'Workshops come with Premium and above.')
  }

  const firstName = str('firstName', 1, 40)
  if (!firstName) return bad('first', 'We need a first name.')
  const middleRaw = typeof b.middleName === 'string' ? b.middleName.trim().replace(/\s+/g, ' ') : ''
  if (middleRaw.length > 40) return bad('middle', 'That middle name is too long.')
  const lastName = str('lastName', 1, 40)
  if (!lastName) return bad('last', 'We need a last name.')

  const email = str('email', 3, 254)
  if (!email || !EMAIL.test(email)) return bad('email', 'That does not look like a working email.')

  const phoneRaw = str('phone', 10, 20)
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null
  if (!phone) return bad('phone', 'Enter exactly 10 digits, without +91.')

  const college = str('college', 2, 120)
  if (!college) return bad('college', 'Which college?')
  const branch = str('branch', 1, 80)
  if (!branch) return bad('branch', 'Which branch?')
  const roll = str('rollNumber', 4, 30)
  if (!roll) return bad('roll', 'We need a roll number.')

  const year = b.yearOfStudy
  if (typeof year !== 'string' || !(YEARS as readonly string[]).includes(year)) return bad('year', 'Pick the year of study.')

  const dob = typeof b.dateOfBirth === 'string' ? b.dateOfBirth : ''
  const age = ageOnEventDay(dob)
  if (age === null) return bad('dob', 'That date does not look right.')
  // The age gate, on the server. The flow blocks it too; that is a courtesy.
  if (age < MINIMUM_AGE) return bad('dob', `${firstName} will be ${age} on 30 October 2026. This event is for people aged ${MINIMUM_AGE} and over.`)
  if (age > 100) return bad('dob', 'That date does not look right.')

  const builderId = typeof b.builderId === 'string' ? normaliseBuilderId(b.builderId) : null
  if (!builderId) return bad('builder', 'We need the AWS Builder ID @username. Do not have one? Create it with the link below.')

  return {
    person: {
      technicalSession,
      ...(workshop ? { workshop } : {}),
      firstName,
      ...(middleRaw ? { middleName: middleRaw } : {}),
      lastName,
      email: email.toLowerCase(),
      phone,
      college,
      branch,
      rollNumber: roll.toUpperCase(),
      yearOfStudy: year as Year,
      dateOfBirth: dob,
      builderId,
    },
  }
}

function readTier(b: Record<string, unknown>): Tier | null {
  return typeof b.tier === 'string' && tierIds.includes(b.tier as Tier) ? (b.tier as Tier) : null
}

function readKey(b: Record<string, unknown>): { submissionKey: string; passId?: string } | null {
  const submissionKey = b.submissionKey
  if (typeof submissionKey !== 'string' || !SUBMISSION_KEY.test(submissionKey)) return null
  const passId = typeof b.passId === 'string' && b.passId ? b.passId : undefined
  return { submissionKey, ...(passId ? { passId } : {}) }
}

export function validateHold(body: unknown): { input: HoldInput; submissionKey: string; passId?: string } | { error: Invalid } {
  if (typeof body !== 'object' || body === null) return { error: { field: 'body', message: 'Send a JSON object.' } }
  const b = body as Record<string, unknown>

  for (const key of Object.keys(b)) {
    // An amount above all: the price is not a parameter.
    if (!(FIELDS as readonly string[]).includes(key)) return { error: { field: key, message: `"${key}" is not accepted.` } }
  }

  const tier = readTier(b)
  if (!tier) return { error: { field: 'tier', message: 'Pick a pass to continue.' } }
  const p = readPerson(b, tier)
  if ('error' in p) return p
  const k = readKey(b)
  if (!k) return { error: { field: 'form', message: 'Reload the page and try again.' } }
  return { input: { tier, ...p.person }, ...k }
}

export type GroupInput = { tier: Tier; members: PersonInput[] }

/**
 * A group: one tier, GROUP_MIN to GROUP_MAX people, the first of whom
 * registers and pays. Each person is read exactly as a single registration
 * is; errors for the second person on carry an m1., m2., ... prefix. Two
 * people in a group may not share an email or a roll number: each gets their
 * own pass and their own mail.
 */
export function validateGroupHold(body: unknown): { group: GroupInput; submissionKey: string; passId?: string } | { error: Invalid } {
  if (typeof body !== 'object' || body === null) return { error: { field: 'body', message: 'Send a JSON object.' } }
  const b = body as Record<string, unknown>
  for (const key of Object.keys(b)) {
    if (!['tier', 'members', 'submissionKey', 'passId'].includes(key)) return { error: { field: key, message: `"${key}" is not accepted.` } }
  }
  const tier = readTier(b)
  if (!tier) return { error: { field: 'tier', message: 'Pick a pass to continue.' } }
  const list = b.members
  if (!Array.isArray(list) || list.length < GROUP_MIN || list.length > GROUP_MAX) {
    return { error: { field: 'group', message: GROUP_MIN === GROUP_MAX ? `A group pass is exactly ${GROUP_MIN} people.` : `A group is ${GROUP_MIN} to ${GROUP_MAX} people.` } }
  }

  const members: PersonInput[] = []
  for (const [i, raw] of list.entries()) {
    const prefix = i === 0 ? '' : `m${i}.`
    if (typeof raw !== 'object' || raw === null) return { error: { field: `${prefix}first`, message: 'Fill in this person.' } }
    const m = raw as Record<string, unknown>
    for (const key of Object.keys(m)) {
      if (!(PERSON_FIELDS as readonly string[]).includes(key)) return { error: { field: key, message: `"${key}" is not accepted.` } }
    }
    const p = readPerson(m, tier, prefix)
    if ('error' in p) return p
    const clash = members.findIndex((o) => o.email === p.person.email)
    if (clash !== -1) return { error: { field: `${prefix}email`, message: `Person ${clash + 1} already uses this email. Everyone needs their own.` } }
    const sameRoll = members.findIndex((o) => o.rollNumber === p.person.rollNumber && o.college.toLowerCase() === p.person.college.toLowerCase())
    if (sameRoll !== -1) return { error: { field: `${prefix}roll`, message: `Person ${sameRoll + 1} already has this roll number.` } }
    const sameBuilder = members.findIndex((o) => o.builderId.toLowerCase() === p.person.builderId.toLowerCase())
    if (sameBuilder !== -1) return { error: { field: `${prefix}builder`, message: `Person ${sameBuilder + 1} already uses this Builder ID. Everyone needs their own.` } }
    members.push(p.person)
  }

  const k = readKey(b)
  if (!k) return { error: { field: 'form', message: 'Reload the page and try again.' } }
  return { group: { tier, members }, ...k }
}
