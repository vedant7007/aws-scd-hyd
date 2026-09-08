import { randomBytes } from 'node:crypto'

/** Primary keys. One place, so a key never gets templated by hand at a call site. */
export const keys = {
  attendee: (ticketRef: string) => ({ PK: `ATT#${ticketRef}`, SK: 'PROFILE' }),
  selection: (ticketRef: string, slotId: string) => ({ PK: `ATT#${ticketRef}`, SK: `SLOT#${slotId}` }),
  session: (sessionId: string) => ({ PK: `SESSION#${sessionId}`, SK: 'META' }),
  config: () => ({ PK: 'CONFIG', SK: 'EVENT' }),
  subscriber: (email: string) => ({ PK: `SUB#${normaliseEmail(email)}`, SK: 'PROFILE' }),
}

/** GSI1 keys, only for the items that are queried through the index. */
export const gsi1 = {
  attendeeByToken: (passToken: string) => ({ GSI1PK: `TOKEN#${passToken}`, GSI1SK: 'ATT' }),
  sessionBySlot: (slotId: string, sessionId: string) => ({
    GSI1PK: `SLOT#${slotId}`,
    GSI1SK: `SESSION#${sessionId}`,
  }),
  subscriberByDate: (createdAt: string) => ({ GSI1PK: 'SUBS', GSI1SK: createdAt }),
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase()

/** 12 random bytes base64url encode to exactly 16 url-safe chars with no padding. */
export const newPassToken = () => randomBytes(12).toString('base64url')
