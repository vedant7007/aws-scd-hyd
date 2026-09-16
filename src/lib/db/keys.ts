import { randomBytes } from 'node:crypto'

/** Primary keys. One place, so a key never gets templated by hand at a call site. */
export const keys = {
  attendee: (ticketRef: string) => ({ PK: `ATT#${ticketRef}`, SK: 'PROFILE' }),
  selection: (ticketRef: string, slotId: string) => ({ PK: `ATT#${ticketRef}`, SK: `SLOT#${slotId}` }),
  session: (sessionId: string) => ({ PK: `SESSION#${sessionId}`, SK: 'META' }),
  config: () => ({ PK: 'CONFIG', SK: 'EVENT' }),
  reconcile: () => ({ PK: 'RECONCILE', SK: 'LATEST' }),
  order: (orderId: string) => ({ PK: `ORDER#${orderId}`, SK: 'ATT' }),
  subscriber: (email: string) => ({ PK: `SUB#${normaliseEmail(email)}`, SK: 'PROFILE' }),
  emailEvent: (email: string, occurredAt: string, type: string) => ({
    PK: `EMAIL#${normaliseEmail(email)}`,
    SK: `EVENT#${occurredAt}#${type}`,
  }),
}

/** GSI1 keys, only for the items that are queried through the index. */
export const gsi1 = {
  attendeeByToken: (passToken: string) => ({ GSI1PK: `TOKEN#${passToken}`, GSI1SK: 'ATT' }),
  sessionBySlot: (slotId: string, sessionId: string) => ({
    GSI1PK: `SLOT#${slotId}`,
    GSI1SK: `SESSION#${sessionId}`,
  }),
  subscriberByDate: (createdAt: string) => ({ GSI1PK: 'SUBS', GSI1SK: createdAt }),
  emailEventByType: (type: string, occurredAt: string) => ({
    GSI1PK: `EMAILEVENT#${type}`,
    GSI1SK: occurredAt,
  }),
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase()

/** 12 random bytes base64url encode to exactly 16 url-safe chars with no padding. */
export const newToken = () => randomBytes(12).toString('base64url')
export const newPassToken = newToken

/**
 * Ticket references are read aloud at a gate and typed into a scanner by hand
 * when a camera fails, so the alphabet drops 0, O, 1, I and L. Six characters
 * give 30^6 possibilities. A collision is caught by the conditional put.
 */
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const newTicketRef = () => {
  const bytes = randomBytes(6)
  let out = 'SCD-'
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length]
  return out
}
