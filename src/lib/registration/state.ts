import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../db/client'
import { gsi1, keys, normaliseEmail } from '../db/keys'
import { getAttendee } from '../db/queries'
import { claimSeat, failedIndexes, releaseSeat, transactWithRetry, type TransactItem } from '../db/tx'
import type { Attendee, CrewAudit, RegistrationState, VerificationLog } from '../db/types'

/**
 * The only legal transitions. Every function below asserts the current
 * state in its ConditionExpression, so an attempt from any other state fails
 * and changes nothing: a double-clicked Verify moves the record once and the
 * second click learns it was already done.
 *
 * `state` is a DynamoDB reserved word, hence #state everywhere.
 */
export const TRANSITIONS: Record<RegistrationState, readonly RegistrationState[]> = {
  AWAITING_PAYMENT: ['PENDING_VERIFICATION', 'ABANDONED'],
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED'],
  VERIFIED: [],
  REJECTED: ['PENDING_VERIFICATION'],
  ABANDONED: ['PENDING_VERIFICATION'],
}

export const canTransition = (from: RegistrationState, to: RegistrationState) => TRANSITIONS[from].includes(to)

const table = () => tableName()
const now = () => new Date().toISOString()

/** The sessions a record holds a seat in: its technical session, and its workshop if it has one. */
export const seatsOf = (a: Pick<Attendee, 'technicalSession' | 'workshop'>) => [a.technicalSession, ...(a.workshop ? [a.workshop] : [])]

/** The log is append only. One item per admin action, under the attendee. */
function logItem(entry: Omit<VerificationLog, 'PK' | 'SK'>): TransactItem {
  return { Put: { TableName: table(), Item: { ...keys.verificationLog(entry.passId, entry.at), ...entry } satisfies VerificationLog } }
}

/** Fails unless the record is in `from`. Extra SET/REMOVE clauses ride along. */
function transitionItem(
  passId: string,
  from: RegistrationState | RegistrationState[],
  to: RegistrationState,
  extra: { set?: Record<string, unknown>; remove?: string[]; condition?: string; values?: Record<string, unknown> } = {},
): TransactItem {
  const froms = Array.isArray(from) ? from : [from]
  const names: Record<string, string> = { '#state': 'state' }
  const values: Record<string, unknown> = { ':to': to, ...(extra.values ?? {}) }
  froms.forEach((f, i) => (values[`:from${i}`] = f))
  const sets = ['#state = :to']
  for (const [k, v] of Object.entries(extra.set ?? {})) {
    names[`#${k}`] = k
    values[`:${k}`] = v
    sets.push(`#${k} = :${k}`)
  }
  const removes = (extra.remove ?? []).map((k) => {
    names[`#${k}`] = k
    return `#${k}`
  })
  const stateCond = froms.length === 1 ? '#state = :from0' : `#state IN (${froms.map((_, i) => `:from${i}`).join(', ')})`
  return {
    Update: {
      TableName: table(),
      Key: keys.attendee(passId),
      UpdateExpression: `SET ${sets.join(', ')}` + (removes.length ? ` REMOVE ${removes.join(', ')}` : ''),
      ConditionExpression: extra.condition ? `${stateCond} AND ${extra.condition}` : stateCond,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    },
  }
}

/* -------------------------------------------------------------------------
   The hold. Made when the student reaches the payment step, and the only
   thing standing between the site and selling more seats in a room than it
   has: the seat claims ride in the same transaction as the record, so if a
   session is full no record exists and the student is told before paying.
   ------------------------------------------------------------------------- */

/** Everything the student chose and typed, validated, plus what the server decided. */
export type HoldRecord = Omit<
  Attendee,
  | 'PK'
  | 'SK'
  | 'GSI1PK'
  | 'GSI1SK'
  | 'passId'
  | 'state'
  | 'createdAt'
  | 'paymentId'
  | 'paidAt'
  | 'utr'
  | 'utrSubmittedAt'
  | 'screenshotKey'
  | 'rejectionReason'
  | 'verifiedBy'
  | 'verifiedAt'
  | 'receiptSentAt'
  | 'confirmationSentAt'
  | 'checkedInAt'
  | 'swagIssuedAt'
> & { holdUntil: string }

export type HoldOutcome =
  | { ok: true; attendee: Attendee }
  /** That session has no seat left, or no ceiling yet. Nothing was written. */
  | { ok: false; reason: 'full'; sessionId: string }
  /** The random pass id collided. Nothing was written; the caller mints another. */
  | { ok: false; reason: 'id-collision' }
  /** The record changed underneath, or belongs to another browser. Nothing was written. */
  | { ok: false; reason: 'stale' }

/** Creates the AWAITING_PAYMENT record and claims its seats, in one transaction. */
export async function createHold(passId: string, rec: HoldRecord): Promise<HoldOutcome> {
  const item: Attendee = {
    ...keys.attendee(passId),
    ...gsi1.attendeeByPass(passId),
    ...rec,
    email: normaliseEmail(rec.email),
    passId,
    state: 'AWAITING_PAYMENT',
    createdAt: now(),
  }
  const seats = seatsOf(rec)
  try {
    // A campus registering at once contends on the session counters, so this
    // path gets more patience than a single write before it gives up.
    await transactWithRetry([{ Put: { TableName: table(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } }, ...seats.map(claimSeat)], 14)
    return { ok: true, attendee: item }
  } catch (err) {
    const failed = failedIndexes(err)
    if (!failed.length) throw err
    const full = failed.find((i) => i >= 1)
    if (full !== undefined) return { ok: false, reason: 'full', sessionId: seats[full - 1]! }
    return { ok: false, reason: 'id-collision' }
  }
}

/**
 * The student went back and changed something, or came back after the clock
 * ran out, on a hold this browser already made. The record is updated in
 * place and its seats moved in the same transaction: seats it no longer
 * needs are given back, new ones are claimed, unchanged ones are left alone.
 * The hold's clock is kept unless it has already run out, so going back to
 * edit never buys more time. Conditional on the state and on the submission
 * key, so nobody else's hold can be touched.
 */
export async function moveHold(before: Attendee, rec: HoldRecord): Promise<HoldOutcome> {
  const had = new Set(seatsOf(before))
  const want = seatsOf(rec)
  const toClaim = want.filter((s) => !had.has(s))
  const toRelease = [...had].filter((s) => !want.includes(s))
  const at = now()
  const keepClock = before.holdUntil && before.holdUntil > at
  const set: Record<string, unknown> = {
    ...rec,
    email: normaliseEmail(rec.email),
    holdUntil: keepClock ? before.holdUntil : rec.holdUntil,
  }
  const remove: string[] = []
  if (!rec.workshop) {
    delete set.workshop
    remove.push('workshop')
  }
  if (!rec.middleName) {
    delete set.middleName
    remove.push('middleName')
  }
  delete set.submissionKeyHash
  const head = transitionItem(before.passId, 'AWAITING_PAYMENT', 'AWAITING_PAYMENT', {
    set,
    remove,
    condition: 'submissionKeyHash = :owner',
    values: { ':owner': rec.submissionKeyHash },
  })
  const claims = toClaim.map(claimSeat)
  try {
    await transactWithRetry([head, ...claims, ...toRelease.map(releaseSeat)], 14)
  } catch (err) {
    const failed = failedIndexes(err)
    if (!failed.length) throw err
    const full = failed.find((i) => i >= 1 && i <= claims.length)
    if (full !== undefined) return { ok: false, reason: 'full', sessionId: toClaim[full - 1]! }
    return { ok: false, reason: 'stale' }
  }
  const attendee = await getAttendee(before.passId)
  return attendee ? { ok: true, attendee } : { ok: false, reason: 'stale' }
}

/* -------------------------------------------------------------------------
   The UTR, and the manual verification transitions.
   ------------------------------------------------------------------------- */

export type UtrOutcome = { ok: true; attendee: Attendee } | { ok: false; reason: 'wrong-state' | 'utr-used' }

/**
 * AWAITING_PAYMENT or REJECTED to PENDING_VERIFICATION with the UTR and the
 * screenshot. The UTR claim item is put in the same transaction with a
 * condition that no other pass owns it, so the table refuses a UTR used
 * twice anywhere in the system. Resubmitting the same UTR after a rejection
 * is allowed: the claim already belongs to this pass.
 */
export async function submitUtr(passId: string, utr: string, screenshotKey: string): Promise<UtrOutcome> {
  const at = now()
  const items: TransactItem[] = [
    transitionItem(passId, ['AWAITING_PAYMENT', 'REJECTED'], 'PENDING_VERIFICATION', {
      set: { utr, utrSubmittedAt: at, screenshotKey },
      remove: ['holdUntil', 'rejectionReason'],
    }),
    {
      Put: {
        TableName: table(),
        Item: { ...keys.utr(utr), utr, passId, submittedAt: at },
        ConditionExpression: 'attribute_not_exists(PK) OR passId = :me',
        ExpressionAttributeValues: { ':me': passId },
      },
    },
  ]
  try {
    await transactWithRetry(items)
    const attendee = await getAttendee(passId)
    if (!attendee) throw new Error(`submitUtr: ${passId} vanished`)
    return { ok: true, attendee }
  } catch (err) {
    const failed = failedIndexes(err)
    if (failed.includes(1)) return { ok: false, reason: 'utr-used' }
    if (failed.includes(0)) return { ok: false, reason: 'wrong-state' }
    throw err
  }
}

export type AdminOutcome = { ok: true; attendee: Attendee } | { ok: false; reason: 'wrong-state' }

/** PENDING_VERIFICATION to VERIFIED. The admin matched the UTR against the statement. */
export async function verify(passId: string, by: string): Promise<AdminOutcome> {
  const at = now()
  const before = await getAttendee(passId)
  if (!before || before.state !== 'PENDING_VERIFICATION') return { ok: false, reason: 'wrong-state' }
  try {
    await transactWithRetry([
      transitionItem(passId, 'PENDING_VERIFICATION', 'VERIFIED', {
        set: { verifiedBy: by, verifiedAt: at, paymentId: `UTR:${before.utr ?? ''}`, paidAt: at },
      }),
      logItem({ passId, action: 'verify', utr: before.utr, by, at }),
    ])
  } catch (err) {
    if (failedIndexes(err).length) return { ok: false, reason: 'wrong-state' }
    throw err
  }
  const attendee = await getAttendee(passId)
  return attendee ? { ok: true, attendee } : { ok: false, reason: 'wrong-state' }
}

/**
 * PENDING_VERIFICATION to REJECTED, with the reason the student is told. The
 * seats stay held: a rejection is usually a mistyped UTR, and the student
 * resubmits against the same record.
 */
export async function reject(passId: string, by: string, reason: string): Promise<AdminOutcome> {
  const at = now()
  const before = await getAttendee(passId)
  if (!before || before.state !== 'PENDING_VERIFICATION') return { ok: false, reason: 'wrong-state' }
  try {
    await transactWithRetry([
      transitionItem(passId, 'PENDING_VERIFICATION', 'REJECTED', { set: { rejectionReason: reason, verifiedBy: by, verifiedAt: at } }),
      logItem({ passId, action: 'reject', utr: before.utr, by, at, reason }),
    ])
  } catch (err) {
    if (failedIndexes(err).length) return { ok: false, reason: 'wrong-state' }
    throw err
  }
  const attendee = await getAttendee(passId)
  return attendee ? { ok: true, attendee } : { ok: false, reason: 'wrong-state' }
}

/**
 * An AWAITING_PAYMENT record whose hold has lapsed is deleted, details and
 * all, and its seats given back, in ONE transaction. The student starts again
 * from the beginning (organiser's decision, 1 October 2026). A crash between
 * the two would leak seats for good; bound together, either both happen or
 * neither. Conditional on the state and the lapsed hold, so a student who
 * submitted a UTR a moment ago is untouched and a sweep racing itself does
 * nothing twice.
 */
export async function abandon(passId: string, at = now()): Promise<{ abandoned: boolean }> {
  const before = await getAttendee(passId)
  if (!before || before.state !== 'AWAITING_PAYMENT') return { abandoned: false }
  try {
    await transactWithRetry([
      {
        Delete: {
          TableName: table(),
          Key: keys.attendee(passId),
          ConditionExpression: '#state = :awaiting AND holdUntil <= :now',
          ExpressionAttributeNames: { '#state': 'state' },
          ExpressionAttributeValues: { ':awaiting': 'AWAITING_PAYMENT', ':now': at },
        },
      },
      ...seatsOf(before).map(releaseSeat),
    ])
    return { abandoned: true }
  } catch (err) {
    if (failedIndexes(err).length) return { abandoned: false }
    throw err
  }
}

/** Records that an email was accepted. First write wins, so a retried send never double counts. */
export async function markSent(passId: string, field: 'receiptSentAt' | 'confirmationSentAt'): Promise<boolean> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: keys.attendee(passId),
        UpdateExpression: 'SET #f = :now',
        ConditionExpression: 'attribute_not_exists(#f)',
        ExpressionAttributeNames: { '#f': field },
        ExpressionAttributeValues: { ':now': now() },
      }),
    )
    return true
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return false
    throw err
  }
}

/* -------------------------------------------------------------------------
   Settings an admin changes. Each write is one transaction with its audit
   item, so a change without a record of who made it cannot happen.
   ------------------------------------------------------------------------- */

export function auditItem(entry: Omit<CrewAudit, 'PK' | 'SK'>): TransactItem {
  return { Put: { TableName: table(), Item: { ...keys.crewAudit(entry.at, entry.target), ...entry } satisfies CrewAudit } }
}

/**
 * The registration switch. Flipped from the settings page, enforced in the
 * hold route. It stops new registrations and nothing else: a hold made
 * before the close still submits its UTR until it lapses, and verification
 * keeps working.
 */
export async function setRegistrationOpen(open: boolean, by: string): Promise<void> {
  const at = now()
  await transactWithRetry([
    {
      Update: {
        TableName: table(),
        Key: keys.config(),
        UpdateExpression: 'SET registrationOpen = :open, registrationOpenChangedAt = :at, registrationOpenChangedBy = :by',
        ExpressionAttributeValues: { ':open': open, ':at': at, ':by': by },
      },
    },
    auditItem({ action: open ? 'registration-open' : 'registration-close', by, target: 'registration', at }),
  ])
}

export type CapacityChange = { ok: true } | { ok: false; reason: 'below-taken'; taken: number }

/**
 * Sets how many seats a session sells. Creates the counter on first use, so
 * nothing needs seeding before an admin can size a room. Refused, with the
 * count, if it would put the ceiling under the seats already held: selling
 * a room past its size is not recoverable on the day, a refusal is.
 */
export async function setSessionCapacity(sessionId: string, capacity: number, by: string): Promise<CapacityChange> {
  const at = now()
  try {
    await transactWithRetry([
      {
        Update: {
          TableName: table(),
          Key: keys.session(sessionId),
          UpdateExpression: 'SET sellableCapacity = :cap, sessionId = :id, seatsTaken = if_not_exists(seatsTaken, :zero)',
          ConditionExpression: 'attribute_not_exists(PK) OR seatsTaken <= :cap',
          ExpressionAttributeValues: { ':cap': capacity, ':id': sessionId, ':zero': 0 },
        },
      },
      auditItem({ action: 'session-capacity', by, target: sessionId, detail: String(capacity), at }),
    ])
    return { ok: true }
  } catch (err) {
    if (!failedIndexes(err).length) throw err
    const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.session(sessionId) }))
    return { ok: false, reason: 'below-taken', taken: Number(res.Item?.seatsTaken ?? 0) }
  }
}
