import { randomBytes } from 'node:crypto'
import type { Track } from './types'

/** Primary keys. One place, so a key never gets templated by hand at a call site. */
export const keys = {
  attendee: (passId: string) => ({ PK: `ATT#${passId}`, SK: 'PROFILE' }),
  seat: (passId: string, sessionId: string) => ({ PK: `ATT#${passId}`, SK: `SEAT#${sessionId}` }),
  verificationLog: (passId: string, at: string) => ({ PK: `ATT#${passId}`, SK: `VERIFY#${at}` }),
  session: (sessionId: string) => ({ PK: `SESSION#${sessionId}`, SK: 'META' }),
  /** One per track: how many registrations count against its room. Amendment 1 section 2. */
  trackCounter: (track: Track) => ({ PK: `TRACK#${track}`, SK: 'COUNTER' }),
  config: () => ({ PK: 'CONFIG', SK: 'EVENT' }),
  earlyBird: () => ({ PK: 'EARLYBIRD', SK: 'COUNTER' }),
  user: (email: string) => ({ PK: `USER#${normaliseEmail(email)}`, SK: 'PROFILE' }),
  usersMeta: () => ({ PK: 'USERS', SK: 'META' }),
  crewAudit: (at: string, target: string) => ({ PK: 'CREWLOG', SK: `${at}#${normaliseEmail(target)}` }),
  /** Written once by the first-admin bootstrap so it can never run twice. */
  bootstrap: () => ({ PK: 'BOOTSTRAP', SK: 'ADMIN' }),
  reconcile: () => ({ PK: 'RECONCILE', SK: 'LATEST' }),
  order: (orderId: string) => ({ PK: `ORDER#${orderId}`, SK: 'ATT' }),
  /** One per UTR ever submitted. Its existence is the uniqueness rule. */
  utr: (utr: string) => ({ PK: `UTR#${utr}`, SK: 'CLAIM' }),
  subscriber: (email: string) => ({ PK: `SUB#${normaliseEmail(email)}`, SK: 'PROFILE' }),
  emailEvent: (email: string, occurredAt: string, type: string) => ({
    PK: `EMAIL#${normaliseEmail(email)}`,
    SK: `EVENT#${occurredAt}#${type}`,
  }),
}

/** GSI1 keys, only for the items that are queried through the index. */
export const gsi1 = {
  /** The pass lookup. Amendment 2 section 1 keeps this pattern: GSI1PK = PASS#<passId>. */
  attendeeByPass: (passId: string) => ({ GSI1PK: `PASS#${passId}`, GSI1SK: 'ATT' }),
  sessionBySlot: (slotId: string, sessionId: string) => ({
    GSI1PK: `SLOT#${slotId}`,
    GSI1SK: `SESSION#${sessionId}`,
  }),
  subscriberByDate: (createdAt: string) => ({ GSI1PK: 'SUBS', GSI1SK: createdAt }),
  /** Every crew account, oldest first. */
  userByDate: (addedAt: string) => ({ GSI1PK: 'USERS', GSI1SK: addedAt }),
  emailEventByType: (type: string, occurredAt: string) => ({
    GSI1PK: `EMAILEVENT#${type}`,
    GSI1SK: occurredAt,
  }),
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase()

/**
 * The pass id. Amendment 2 section 1: the one identifier, printed on the pass,
 * encoded in the QR, typed into the entry page, read aloud at the gate.
 *
 * "SCD-" and 10 characters from a 31 letter alphabet with no I, L, O, U, 0
 * or 1, so nothing reads as anything else. 31^10 is about 49 bits, which is
 * why it is safe to expose in a form that people type.
 *
 * Each character is one byte from crypto.randomBytes, accepted only when it
 * falls below the largest multiple of 31 that fits in a byte (248) and then
 * reduced. Rejecting the top 8 values is what keeps every letter equally
 * likely; a plain modulo would favour the first eight.
 */
export const PASS_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
export const PASS_LENGTH = 10
const PASS_PREFIX = 'SCD-'
const ACCEPT_BELOW = Math.floor(256 / PASS_ALPHABET.length) * PASS_ALPHABET.length

export function newPassId(): string {
  let out = ''
  while (out.length < PASS_LENGTH) {
    for (const b of randomBytes(PASS_LENGTH)) {
      if (b >= ACCEPT_BELOW) continue
      out += PASS_ALPHABET[b % PASS_ALPHABET.length]
      if (out.length === PASS_LENGTH) break
    }
  }
  return PASS_PREFIX + out
}

const CANONICAL = new RegExp(`^SCD[${PASS_ALPHABET}]{${PASS_LENGTH}}$`)

/**
 * What a person typed, to the one form the table knows. Uppercase, drop
 * whitespace and hyphens, then re-apply the canonical prefix and hyphen.
 * "scd k4m7pqr29t", "SCDK4M7PQR29T" and "SCD-K4M7PQR29T" all come back as
 * SCD-K4M7PQR29T. Null for anything that cannot be a pass id at all.
 */
export function normalisePassId(input: string): string | null {
  const bare = input.toUpperCase().replace(/[\s-]+/g, '')
  if (!CANONICAL.test(bare)) return null
  return PASS_PREFIX + bare.slice(3)
}

/** 12 random bytes base64url encode to exactly 16 url-safe chars with no padding. */
export const newToken = () => randomBytes(12).toString('base64url')
