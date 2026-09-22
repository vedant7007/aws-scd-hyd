import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ROOM_RESERVE, rooms } from '../../content/event'
import { EARLY_BIRD_TOTAL } from '../../content/passes'
import { sessionIdFor } from '../../content/sessions'
import { ddb, tableName } from '../db/client'
import { gsi1, keys, normaliseEmail } from '../db/keys'
import { getAttendee, getAttendeeWithSeats } from '../db/queries'
import { claimItems, failedIndexes, filledSession, releaseItems, transactWithRetry, type Pick, type TransactItem } from '../db/seats'
import type { Attendee, CrewAudit, EarlyBirdCounter, OrderPointer, PaymentMode, RegistrationState, Track, VerificationLog, YearOfStudy } from '../db/types'

/**
 * Amendment 1 section 1. The only legal transitions. Every function below
 * asserts the current state in its ConditionExpression, so an attempt from
 * any other state fails and changes nothing: a double-clicked Verify moves
 * the record once and the second click learns it was already done.
 *
 * `state` is a DynamoDB reserved word, hence #state everywhere.
 */
export const TRANSITIONS: Record<RegistrationState, readonly RegistrationState[]> = {
  AWAITING_PAYMENT: ['PENDING_VERIFICATION', 'ABANDONED', /* Razorpay mode only, applied by settle() on a verified webhook */ 'VERIFIED'],
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SESSIONS_SELECTED'],
  SESSIONS_SELECTED: [],
  REJECTED: ['PENDING_VERIFICATION'],
  ABANDONED: ['PENDING_VERIFICATION'],
}

export const canTransition = (from: RegistrationState, to: RegistrationState) => TRANSITIONS[from].includes(to)

const table = () => tableName()
const now = () => new Date().toISOString()

/** The log is append only. One item per admin action, under the attendee. */
function logItem(entry: Omit<VerificationLog, 'PK' | 'SK'>): TransactItem {
  return { Put: { TableName: table(), Item: { ...keys.verificationLog(entry.passId, entry.at), ...entry } satisfies VerificationLog } }
}

/** Fails unless the record is in `from`. Extra SET/REMOVE clauses ride along. */
function transitionItem(
  passId: string,
  from: RegistrationState | RegistrationState[],
  to: RegistrationState,
  extra: { set?: Record<string, unknown>; remove?: string[] } = {},
): TransactItem {
  const froms = Array.isArray(from) ? from : [from]
  const names: Record<string, string> = { '#state': 'state' }
  const values: Record<string, unknown> = { ':to': to }
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
  return {
    Update: {
      TableName: table(),
      Key: keys.attendee(passId),
      UpdateExpression: `SET ${sets.join(', ')}` + (removes.length ? ` REMOVE ${removes.join(', ')}` : ''),
      ConditionExpression: froms.length === 1 ? '#state = :from0' : `#state IN (${froms.map((_, i) => `:from${i}`).join(', ')})`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    },
  }
}

/* -------------------------------------------------------------------------
   Step one. Amendment 1 section 2.1.
   ------------------------------------------------------------------------- */

export type Registration = {
  name: string
  email: string
  phone: string
  college: string
  tier: Attendee['tier']
  homeTrack: Track
  foodPreference: Attendee['foodPreference']
  yearOfStudy: YearOfStudy
  /** Ticked on the form. The route refuses anything but true. */
  over18: true
}

export type PaymentSetup = {
  mode: PaymentMode
  /** Decided by the server from content. Never from the client. */
  amountPaise: number
  /** Razorpay only. */
  orderId?: string
  /** When the sweep may abandon it if no UTR arrives. */
  holdUntil: string
  /** Browser-generated once per form, so a double submit resolves to the one record it made. */
  submissionKey: string
  /**
   * Claim an early bird place in the same transaction. amountPaise is then
   * the discounted price and listPricePaise the full one. Absent means full
   * price with no claim attempted.
   */
  earlyBird?: { listPricePaise: number }
  /** The pool emptied a moment before this attempt; the record says so and is charged full price. */
  earlyBirdMissed?: boolean
}

export type RegisterOutcome =
  | { ok: true; attendee: Attendee; duplicate: false }
  /** This submission key was already used: the record it made, nothing new written. */
  | { ok: true; attendee: Attendee; duplicate: true }
  /** The home track's counter is at its ceiling, or has no ceiling yet. Nothing was written. */
  | { ok: false; reason: 'track-full'; track: Track }
  /** The random pass id collided. Nothing was written; the caller mints another. */
  | { ok: false; reason: 'id-collision' }
  /** The early bird pool emptied between the read and the write. Nothing was written; the caller retries at full price. */
  | { ok: false; reason: 'early-bird-out' }

/**
 * Creates the record in AWAITING_PAYMENT and counts it against its home
 * track, in one transaction. The counter's condition is the only thing
 * standing between the site and selling more passes for a track than its
 * room holds: if it fails, no record exists and the student is told the
 * track is full before ever seeing the payment screen.
 *
 * A submission item keyed by the browser's key is written alongside, so a
 * form submitted twice (double click, retry after a timeout) finds its own
 * record instead of making a second one and counting twice.
 *
 * With earlyBird set, the EARLYBIRD counter is incremented under its
 * ceiling in the same transaction, so the discounted price is locked into
 * the record only if a place was actually claimed: the two can never
 * disagree, and the pool can never be claimed more than ceiling times.
 */
export async function registerStepOne(passId: string, reg: Registration, payment: PaymentSetup): Promise<RegisterOutcome> {
  const t = table()
  const at = now()
  const item: Attendee = {
    ...keys.attendee(passId),
    ...gsi1.attendeeByPass(passId),
    passId,
    name: reg.name,
    email: normaliseEmail(reg.email),
    phone: reg.phone,
    college: reg.college,
    tier: reg.tier,
    homeTrack: reg.homeTrack,
    foodPreference: reg.foodPreference,
    yearOfStudy: reg.yearOfStudy,
    over18: reg.over18,
    state: 'AWAITING_PAYMENT',
    paymentMode: payment.mode,
    amountPaise: payment.amountPaise,
    ...(payment.earlyBird ? { earlyBird: true, listPricePaise: payment.earlyBird.listPricePaise } : {}),
    ...(payment.earlyBirdMissed ? { earlyBirdMissed: true } : {}),
    ...(payment.orderId ? { orderId: payment.orderId } : {}),
    holdUntil: payment.holdUntil,
    source: 'checkout',
    createdAt: at,
  }

  const items: TransactItem[] = [
    { Put: { TableName: t, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
    {
      Put: {
        TableName: t,
        Item: { PK: `SUBMIT#${payment.submissionKey}`, SK: 'REG', passId, createdAt: at, expiresAt: Math.floor(Date.now() / 1000) + 86_400 },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    {
      Update: {
        TableName: t,
        Key: keys.trackCounter(reg.homeTrack),
        UpdateExpression: 'SET registered = registered + :one',
        ConditionExpression: 'registered < #ceiling',
        ExpressionAttributeNames: { '#ceiling': 'ceiling' },
        ExpressionAttributeValues: { ':one': 1 },
      },
    },
  ]
  if (payment.orderId) {
    const pointer: OrderPointer = { ...keys.order(payment.orderId), orderId: payment.orderId, passId }
    items.push({ Put: { TableName: t, Item: pointer, ConditionExpression: 'attribute_not_exists(PK)' } })
  }
  const earlyBirdIndex = payment.earlyBird ? items.push(earlyBirdItem(+1)) - 1 : -1

  try {
    // A campus registering at once contends on the two counters, so this
    // path gets more patience than a seat claim before it gives up.
    await transactWithRetry(items, 14)
    return { ok: true, attendee: item, duplicate: false }
  } catch (err) {
    const failed = failedIndexes(err)
    if (!(err instanceof TransactionCanceledException) || failed.length === 0) throw err
    if (failed.includes(1)) {
      // Seen this submission before. Hand back what it made.
      const seen = await ddb.send(new UpdateCommand({ TableName: t, Key: { PK: `SUBMIT#${payment.submissionKey}`, SK: 'REG' }, UpdateExpression: 'SET seenAgain = :t', ExpressionAttributeValues: { ':t': at }, ReturnValues: 'ALL_NEW' }))
      const existing = await getAttendee(String(seen.Attributes?.passId ?? ''))
      if (existing) return { ok: true, attendee: existing, duplicate: true }
    }
    if (failed.includes(2)) return { ok: false, reason: 'track-full', track: reg.homeTrack }
    if (earlyBirdIndex >= 0 && failed.includes(earlyBirdIndex)) return { ok: false, reason: 'early-bird-out' }
    if (failed.includes(0)) return { ok: false, reason: 'id-collision' }
    throw err
  }
}

/* -------------------------------------------------------------------------
   Early bird. The pool is one counter item, same pattern as a track.
   ------------------------------------------------------------------------- */

/** +1 claims a place under the ceiling, -1 gives one back. Both conditional, both part of a larger transaction. */
function earlyBirdItem(delta: 1 | -1): TransactItem {
  return delta === 1
    ? {
        Update: {
          TableName: table(),
          Key: keys.earlyBird(),
          UpdateExpression: 'SET claimed = claimed + :one',
          ConditionExpression: 'claimed < #ceiling',
          ExpressionAttributeNames: { '#ceiling': 'ceiling' },
          ExpressionAttributeValues: { ':one': 1 },
        },
      }
    : {
        Update: {
          TableName: table(),
          Key: keys.earlyBird(),
          UpdateExpression: 'SET claimed = claimed - :one',
          ConditionExpression: 'claimed > :zero',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
        },
      }
}

/** The pool as it stands. A consistent read on every request that shows it; never cached. Null until created. */
export async function earlyBirdCounter(): Promise<EarlyBirdCounter | null> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.earlyBird(), ConsistentRead: true }))
  return (res.Item as EarlyBirdCounter | undefined) ?? null
}

/** Places left, or 0 when the pool is empty or was never created. What the landing and the form show. */
export async function earlyBirdLeft(): Promise<number> {
  const c = await earlyBirdCounter()
  return c ? Math.max(0, c.ceiling - c.claimed) : 0
}

/** Creates the pool once. A later call changes nothing, so claimed is never reset. */
export async function ensureEarlyBirdCounter(): Promise<void> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: { ...keys.earlyBird(), claimed: 0, ceiling: EARLY_BIRD_TOTAL } satisfies EarlyBirdCounter,
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    )
  } catch (err) {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err
  }
}

/* -------------------------------------------------------------------------
   Step two, and the manual verification transitions.
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

/** PENDING_VERIFICATION to REJECTED, with the reason the student is told. */
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

export type ReinstateOutcome =
  /** priced says what happened to a discounted record: kept its early bird price, or fell back to the full price because the pool is empty. */
  | { ok: true; attendee: Attendee; priced: 'early' | 'full' | 'unchanged' }
  | { ok: false; reason: 'wrong-state' | 'utr-used' }
  /** The home track filled while the record was abandoned. Nothing changed; offer a refund or another track. */
  | { ok: false; reason: 'track-full'; track: Track }

/**
 * Amendment 1 section 2.4. ABANDONED back to PENDING_VERIFICATION with a UTR
 * the admin typed in. The track counter is re-incremented under its ceiling
 * in the same transaction and fails loudly if the track is now full, so the
 * room is never quietly oversold.
 *
 * A record that held an early bird price gave its place back when it was
 * abandoned. Reinstating tries to take one again in the same transaction;
 * if the pool is empty by now the record comes back at the full price
 * stored beside the discount, and the caller is told which happened.
 */
export async function reinstate(passId: string, by: string, utr: string, withEarlyBird = true): Promise<ReinstateOutcome> {
  const at = now()
  const before = await getAttendee(passId)
  if (!before || before.state !== 'ABANDONED') return { ok: false, reason: 'wrong-state' }
  const discounted = before.earlyBird === true && typeof before.listPricePaise === 'number'
  const wantsEarly = withEarlyBird && discounted
  const fallsBack = !withEarlyBird && discounted
  const items: TransactItem[] = [
    transitionItem(passId, 'ABANDONED', 'PENDING_VERIFICATION', {
      set: {
        utr,
        utrSubmittedAt: at,
        verifiedBy: by,
        verifiedAt: at,
        ...(fallsBack ? { amountPaise: before.listPricePaise, earlyBird: false, earlyBirdMissed: true } : {}),
      },
    }),
    {
      Update: {
        TableName: table(),
        Key: keys.trackCounter(before.homeTrack),
        UpdateExpression: 'SET registered = registered + :one',
        ConditionExpression: 'registered < #ceiling',
        ExpressionAttributeNames: { '#ceiling': 'ceiling' },
        ExpressionAttributeValues: { ':one': 1 },
      },
    },
    {
      Put: {
        TableName: table(),
        Item: { ...keys.utr(utr), utr, passId, submittedAt: at },
        ConditionExpression: 'attribute_not_exists(PK) OR passId = :me',
        ExpressionAttributeValues: { ':me': passId },
      },
    },
    logItem({ passId, action: 'reinstate', utr, by, at, detail: fallsBack ? 'early bird pool empty, reinstated at full price' : wantsEarly ? 'early bird place re-claimed' : undefined }),
  ]
  if (wantsEarly) items.push(earlyBirdItem(+1))
  try {
    await transactWithRetry(items)
  } catch (err) {
    const failed = failedIndexes(err)
    // Only the early bird claim failed: the pool emptied while the record was abandoned. Once more, at full price.
    if (wantsEarly && failed.includes(4) && !failed.some((i) => i < 4)) return reinstate(passId, by, utr, false)
    if (failed.includes(1)) return { ok: false, reason: 'track-full', track: before.homeTrack }
    if (failed.includes(2)) return { ok: false, reason: 'utr-used' }
    if (failed.includes(0)) return { ok: false, reason: 'wrong-state' }
    throw err
  }
  const attendee = await getAttendee(passId)
  return attendee ? { ok: true, attendee, priced: fallsBack ? 'full' : wantsEarly ? 'early' : 'unchanged' } : { ok: false, reason: 'wrong-state' }
}

/**
 * Amendment 1 section 2.3. AWAITING_PAYMENT whose hold has lapsed to
 * ABANDONED, and its track counter down by one, in ONE transaction. A crash
 * between the two would leak a track slot for good; bound together, either
 * both happen or neither. Conditional on the state and the lapsed hold, so
 * a student who submitted a UTR a moment ago is untouched and a sweep racing
 * itself does nothing twice. A record holding an early bird place gives it
 * back in the same transaction.
 */
export async function abandon(passId: string, at = now()): Promise<{ abandoned: boolean }> {
  const before = await getAttendee(passId)
  if (!before || before.state !== 'AWAITING_PAYMENT') return { abandoned: false }
  const cond = transitionItem(passId, 'AWAITING_PAYMENT', 'ABANDONED', { remove: ['holdUntil'] })
  // Tighten the transition: the hold really has lapsed.
  const u = cond.Update!
  u.ConditionExpression += ' AND holdUntil <= :now'
  u.ExpressionAttributeValues = { ...u.ExpressionAttributeValues, ':now': at }
  try {
    await transactWithRetry([
      cond,
      {
        Update: {
          TableName: table(),
          Key: keys.trackCounter(before.homeTrack),
          UpdateExpression: 'SET registered = registered - :one',
          ConditionExpression: 'registered > :zero',
          ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
        },
      },
      ...(before.earlyBird ? [earlyBirdItem(-1)] : []),
    ])
    return { abandoned: true }
  } catch (err) {
    if (failedIndexes(err).length) return { abandoned: false }
    throw err
  }
}

/** Razorpay mode only. AWAITING_PAYMENT to VERIFIED on a verified capture for the recorded amount. */
export async function verifyByProvider(passId: string, paymentId: string, amountPaise: number): Promise<AdminOutcome> {
  const at = now()
  const item = transitionItem(passId, 'AWAITING_PAYMENT', 'VERIFIED', { set: { paymentId, paidAt: at, verifiedAt: at, verifiedBy: 'razorpay' }, remove: ['holdUntil'] })
  const u = item.Update!
  u.ConditionExpression += ' AND amountPaise = :amount'
  u.ExpressionAttributeValues = { ...u.ExpressionAttributeValues, ':amount': amountPaise }
  try {
    await transactWithRetry([item])
  } catch (err) {
    if (failedIndexes(err).length) return { ok: false, reason: 'wrong-state' }
    throw err
  }
  const attendee = await getAttendee(passId)
  return attendee ? { ok: true, attendee } : { ok: false, reason: 'wrong-state' }
}

/* -------------------------------------------------------------------------
   Sessions. Amendment 2 sections 3 to 5.
   ------------------------------------------------------------------------- */

export type SelectOutcome =
  | { ok: true; attendee: Attendee }
  | { ok: false; reason: 'wrong-state' }
  /** One session had no seat left. Nothing was claimed. */
  | { ok: false; reason: 'filled'; sessionId: string }

/**
 * VERIFIED to SESSIONS_SELECTED with all four seats, in one transaction:
 * either every seat is claimed and the state moves, or nothing happens. The
 * caller has already checked the picks against the tier allowance and the
 * one-per-slot rule. Selections are final; only an admin changes them.
 */
export async function selectSessions(passId: string, picks: Pick[]): Promise<SelectOutcome> {
  const at = now()
  const head: TransactItem[] = [transitionItem(passId, 'VERIFIED', 'SESSIONS_SELECTED', { set: { sessionsSelectedAt: at } })]
  try {
    await transactWithRetry([...head, ...claimItems(passId, picks, at)])
  } catch (err) {
    const filled = filledSession(err, picks, head.length)
    if (filled) return { ok: false, reason: 'filled', sessionId: filled }
    if (failedIndexes(err).length) return { ok: false, reason: 'wrong-state' }
    throw err
  }
  const attendee = await getAttendee(passId)
  return attendee ? { ok: true, attendee } : { ok: false, reason: 'wrong-state' }
}

export type ChangeOutcome =
  | { ok: true; released: number; claimed: number }
  | { ok: false; reason: 'wrong-state' | 'stale' }
  | { ok: false; reason: 'filled'; sessionId: string }

/**
 * Amendment 2 section 5. An admin moving an attendee to different sessions
 * releases the seats they no longer hold and claims the new ones in one
 * transaction, so the two counts never drift apart. Unchanged slots are left
 * alone.
 */
export async function adminChangeSelection(passId: string, by: string, picks: Pick[]): Promise<ChangeOutcome> {
  const at = now()
  const { attendee, seats } = await getAttendeeWithSeats(passId)
  if (!attendee || attendee.state !== 'SESSIONS_SELECTED') return { ok: false, reason: 'wrong-state' }

  const keep = new Set(picks.map((p) => p.sessionId))
  const toRelease = seats.filter((s) => !keep.has(s.sessionId))
  const held = new Set(seats.map((s) => s.sessionId))
  const toClaim = picks.filter((p) => !held.has(p.sessionId))

  // The state assertion rides along so a record that changed underneath the admin is refused.
  const head: TransactItem[] = [
    transitionItem(passId, 'SESSIONS_SELECTED', 'SESSIONS_SELECTED', { set: { sessionsSelectedAt: at } }),
    ...releaseItems(toRelease),
  ]
  const detail = `${toRelease.map((s) => s.sessionId).join(',') || 'none'} -> ${toClaim.map((p) => p.sessionId).join(',') || 'none'}`
  try {
    await transactWithRetry([...head, ...claimItems(passId, toClaim, at), logItem({ passId, action: 'change-selection', by, at, detail })])
  } catch (err) {
    const filled = filledSession(err, toClaim, head.length)
    if (filled) return { ok: false, reason: 'filled', sessionId: filled }
    if (failedIndexes(err).length) return { ok: false, reason: 'stale' }
    throw err
  }
  return { ok: true, released: toRelease.length, claimed: toClaim.length }
}

/** Records that an email was accepted. First write wins, so a retried send never double counts. */
export async function markSent(passId: string, field: 'receiptSentAt' | 'confirmationSentAt' | 'sessionsReleaseEmailSentAt' | 'passReadySentAt'): Promise<boolean> {
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
 * step one route. It stops new registrations and nothing else: a record
 * made before the close still submits its UTR until its hold lapses, and
 * verification, session release and selection all keep working.
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

export type RoomChange =
  | { ok: true; ceiling: number }
  /** The room would seat fewer than have already registered. Nothing changed. */
  | { ok: false; reason: 'below-registered'; registered: number; ceiling: number }
  | { ok: false; reason: 'no-such-room' }

/**
 * Moves a track to a room. The track counter's ceiling becomes the room's
 * sellable count, and the track's four sessions take the room and both
 * capacities, all in one transaction. The counter update is conditional on
 * registered <= the new ceiling, and each session on seatsTaken <= its new
 * sellable count, so a room too small for the people already counted
 * against the track is refused outright and the refusal names the count.
 * Overselling a room is not recoverable on event day; a refusal is.
 */
export async function setTrackRoom(track: Track, roomId: string, by: string, slotIds: string[]): Promise<RoomChange> {
  const room = rooms.find((r) => r.id === roomId && r.role === 'track')
  if (!room) return { ok: false, reason: 'no-such-room' }
  const ceiling = room.physicalCapacity - ROOM_RESERVE
  const at = now()
  const items: TransactItem[] = [
    {
      Update: {
        TableName: table(),
        Key: keys.trackCounter(track),
        UpdateExpression: 'SET #ceiling = :ceiling',
        ConditionExpression: 'attribute_exists(PK) AND registered <= :ceiling',
        ExpressionAttributeNames: { '#ceiling': 'ceiling' },
        ExpressionAttributeValues: { ':ceiling': ceiling },
      },
    },
    {
      Update: {
        TableName: table(),
        Key: keys.config(),
        UpdateExpression: 'SET roomForTrack.#track = :room',
        ExpressionAttributeNames: { '#track': track },
        ExpressionAttributeValues: { ':room': roomId },
      },
    },
    ...slotIds.map((slotId) => ({
      Update: {
        TableName: table(),
        Key: keys.session(sessionIdFor(slotId, track)),
        UpdateExpression: 'SET roomId = :room, physicalCapacity = :physical, sellableCapacity = :sellable',
        ConditionExpression: 'attribute_exists(PK) AND seatsTaken <= :sellable',
        ExpressionAttributeValues: { ':room': roomId, ':physical': room.physicalCapacity, ':sellable': ceiling },
      },
    })),
    auditItem({ action: 'track-room', by, target: track, detail: `${roomId}, ceiling ${ceiling}`, at }),
  ]
  try {
    await transactWithRetry(items)
    return { ok: true, ceiling }
  } catch (err) {
    if (failedIndexes(err).length) {
      const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.trackCounter(track) }))
      return { ok: false, reason: 'below-registered', registered: Number(res.Item?.registered ?? 0), ceiling }
    }
    throw err
  }
}
