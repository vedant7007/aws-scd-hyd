import { MINIMUM_AGE, YEARS, ageOnEventDay, hasWorkshop, technicalSessions, workshops, type Year } from '../../content/program'
import { tierIds } from '../../content/passes'
import type { FoodPreference, Tier } from '../db/types'

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
  foodPreference: FoodPreference
  dateOfBirth: string
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
  'foodPreference',
  'dateOfBirth',
  'submissionKey',
  'passId',
] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SUBMISSION_KEY = /^[A-Za-z0-9_-]{16,64}$/
const FOODS: FoodPreference[] = ['veg', 'nonveg']

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

export function validateHold(body: unknown): { input: HoldInput; submissionKey: string; passId?: string } | { error: Invalid } {
  if (typeof body !== 'object' || body === null) return { error: { field: 'body', message: 'Send a JSON object.' } }
  const b = body as Record<string, unknown>

  for (const key of Object.keys(b)) {
    // An amount above all: the price is not a parameter.
    if (!(FIELDS as readonly string[]).includes(key)) return { error: { field: key, message: `"${key}" is not accepted.` } }
  }

  const str = (k: (typeof FIELDS)[number], min: number, max: number): string | null => {
    const v = b[k]
    if (typeof v !== 'string') return null
    const t = v.trim().replace(/\s+/g, ' ')
    return t.length >= min && t.length <= max ? t : null
  }

  const tier = b.tier
  if (typeof tier !== 'string' || !tierIds.includes(tier as Tier)) return { error: { field: 'tier', message: 'Pick a pass to continue.' } }

  const technicalSession = b.technicalSession
  if (typeof technicalSession !== 'string' || !technicalSessions.some((s) => s.id === technicalSession)) {
    return { error: { field: 'tech', message: 'Choose the technical session you want to attend.' } }
  }

  let workshop: string | undefined
  if (hasWorkshop(tier as Tier)) {
    if (typeof b.workshop !== 'string' || !workshops.some((s) => s.id === b.workshop)) {
      return { error: { field: 'workshop', message: 'Choose the hands-on workshop you want to attend.' } }
    }
    workshop = b.workshop
  } else if (b.workshop !== undefined && b.workshop !== '' && b.workshop !== null) {
    return { error: { field: 'workshop', message: 'Workshops come with Premium and above.' } }
  }

  const firstName = str('firstName', 1, 40)
  if (!firstName) return { error: { field: 'first', message: 'We need your first name.' } }
  const middleRaw = typeof b.middleName === 'string' ? b.middleName.trim().replace(/\s+/g, ' ') : ''
  if (middleRaw.length > 40) return { error: { field: 'middle', message: 'That middle name is too long.' } }
  const lastName = str('lastName', 1, 40)
  if (!lastName) return { error: { field: 'last', message: 'We need your last name.' } }

  const email = str('email', 3, 254)
  if (!email || !EMAIL.test(email)) return { error: { field: 'email', message: 'That does not look like a working email.' } }

  const phoneRaw = str('phone', 10, 20)
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null
  if (!phone) return { error: { field: 'phone', message: 'Enter exactly 10 digits, without +91.' } }

  const college = str('college', 2, 120)
  if (!college) return { error: { field: 'college', message: 'Which college are you from?' } }
  const branch = str('branch', 1, 80)
  if (!branch) return { error: { field: 'branch', message: 'Which branch are you in?' } }
  const roll = str('rollNumber', 4, 30)
  if (!roll) return { error: { field: 'roll', message: 'We need your roll number.' } }

  const year = b.yearOfStudy
  if (typeof year !== 'string' || !(YEARS as readonly string[]).includes(year)) return { error: { field: 'year', message: 'Pick your year.' } }

  const food = b.foodPreference
  if (typeof food !== 'string' || !FOODS.includes(food as FoodPreference)) return { error: { field: 'food', message: 'Pick veg or non-veg.' } }

  const dob = typeof b.dateOfBirth === 'string' ? b.dateOfBirth : ''
  const age = ageOnEventDay(dob)
  if (age === null) return { error: { field: 'dob', message: 'That date does not look right.' } }
  // The age gate, on the server. The flow blocks it too; that is a courtesy.
  if (age < MINIMUM_AGE) return { error: { field: 'dob', message: `You will be ${age} on 30 October 2026. This event is for people aged ${MINIMUM_AGE} and over.` } }
  if (age > 100) return { error: { field: 'dob', message: 'That date does not look right.' } }

  const submissionKey = b.submissionKey
  if (typeof submissionKey !== 'string' || !SUBMISSION_KEY.test(submissionKey)) return { error: { field: 'form', message: 'Reload the page and try again.' } }
  const passId = typeof b.passId === 'string' && b.passId ? b.passId : undefined

  return {
    input: {
      tier: tier as Tier,
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
      foodPreference: food as FoodPreference,
      dateOfBirth: dob,
    },
    submissionKey,
    ...(passId ? { passId } : {}),
  }
}
