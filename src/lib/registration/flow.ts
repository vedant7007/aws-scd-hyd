import { createHash } from 'node:crypto'
import { holdMinutes } from '../../content/payment'
import { newPassId } from '../db/keys'
import { getAttendee, listAttendees } from '../db/queries'
import type { Attendee, AttendeeSource } from '../db/types'
import { isReservedAddress, sendEmail } from '../email/send'
import { confirmation, receipt, rejection } from '../email/templates'
import { amountFor } from '../tickets/pricing'
import { abandon, createHold, markSent, moveHold, reinstate, reject, submitUtr, verify, type HoldOutcome, type ReinstateOutcome } from './state'
import type { HoldInput } from './validate'

/**
 * One email, then the mark that says it went. A reserved (seeded) address is
 * skipped silently; any other failure is logged and the mark is left absent,
 * so the reconcile run can retry what is owed.
 */
async function mail(a: Attendee, body: Omit<Parameters<typeof sendEmail>[0], 'to'>, field: Parameters<typeof markSent>[1]): Promise<boolean> {
  if (isReservedAddress(a.email)) return false
  try {
    await sendEmail({ to: a.email, ...body })
    await markSent(a.passId, field)
    return true
  } catch (err) {
    console.error(`[email] ${field} for ${a.passId} failed, left owed`, err)
    return false
  }
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

/* ---- the hold ------------------------------------------------------------ */

export type Held = { ok: true; attendee: Attendee; moved: boolean } | Extract<HoldOutcome, { ok: false; reason: 'full' }>

/**
 * The payment step. Makes the AWAITING_PAYMENT record and its seats, or, when
 * this browser already made one (it sends the pass id back with the same
 * submission key), updates that record in place and moves its seats. The
 * amount is decided here from content and locked into the record: the admin
 * verifies against that number and nothing the browser said.
 */
export async function placeHold(input: HoldInput, submissionKey: string, previousPassId: string | undefined, source: AttendeeSource): Promise<Held> {
  const amount = amountFor(input.tier)
  const keyHash = hashKey(submissionKey)
  const holdUntil = new Date(Date.now() + holdMinutes * 60_000).toISOString()
  const name = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(' ')
  const rec = { ...input, name, amountPaise: amount.amountPaise, submissionKeyHash: keyHash, holdUntil, source }

  if (previousPassId) {
    const before = await getAttendee(previousPassId)
    // Only a live hold this browser made is moved. Anything else (swept,
    // paid, someone else's) is left alone and a fresh hold is made.
    if (before && before.state === 'AWAITING_PAYMENT' && before.submissionKeyHash === keyHash) {
      const out = await moveHold(before, rec)
      if (out.ok) return { ok: true, attendee: out.attendee, moved: true }
      if (out.reason === 'full') return out
    }
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const out = await createHold(newPassId(), rec)
    if (out.ok) return { ok: true, attendee: out.attendee, moved: false }
    if (out.reason === 'full') return out
  }
  throw new Error('placeHold: four pass id collisions in a row, which should not be possible')
}

/* ---- the UTR ----------------------------------------------------------- */

export type Submitted = { ok: true; attendee: Attendee; emailed: boolean } | { ok: false; reason: 'wrong-state' | 'utr-used' }

/** UTR and screenshot in, PENDING_VERIFICATION, email 1 out with the pass id. */
export async function submitPayment(passId: string, utr: string, screenshotKey: string): Promise<Submitted> {
  const out = await submitUtr(passId, utr, screenshotKey)
  if (!out.ok) return out
  const emailed = await mail(out.attendee, receipt(out.attendee), 'receiptSentAt')
  return { ok: true, attendee: out.attendee, emailed }
}

/* ---- admin ------------------------------------------------------------- */

export async function adminVerify(passId: string, by: string): Promise<{ ok: true; emailed: boolean } | { ok: false; reason: 'wrong-state' }> {
  const out = await verify(passId, by)
  if (!out.ok) return out
  // Only the call that moved the record sends. A second click never gets here.
  const emailed = await mail(out.attendee, confirmation(out.attendee), 'confirmationSentAt')
  return { ok: true, emailed }
}

export async function adminReject(passId: string, by: string, reason: string): Promise<{ ok: true; emailed: boolean } | { ok: false; reason: 'wrong-state' }> {
  const out = await reject(passId, by, reason)
  if (!out.ok) return out
  let emailed = false
  if (!isReservedAddress(out.attendee.email)) {
    try {
      await sendEmail({ to: out.attendee.email, ...rejection(out.attendee, out.attendee.utr ?? '', reason) })
      emailed = true
    } catch (err) {
      console.error(`[email] rejection for ${passId} failed`, err)
    }
  }
  return { ok: true, emailed }
}

export async function adminReinstate(passId: string, by: string, utr: string): Promise<ReinstateOutcome & { emailed?: boolean }> {
  const out = await reinstate(passId, by, utr)
  if (!out.ok) return out
  // The receipt goes out again: they are back in the queue.
  const emailed = await mail(out.attendee, receipt(out.attendee), 'receiptSentAt')
  return { ...out, emailed }
}

/* ---- the sweep --------------------------------------------------------- */

/**
 * Every AWAITING_PAYMENT record whose hold has lapsed goes to ABANDONED and
 * gives its seats back, each in its own transaction. No email: a student who
 * never paid should not be chased.
 */
export async function sweepAbandoned(at = new Date().toISOString()): Promise<{ abandoned: number; checked: number }> {
  let abandoned = 0
  let checked = 0
  for (const a of await listAttendees()) {
    if (a.state !== 'AWAITING_PAYMENT' || !a.holdUntil || a.holdUntil > at) continue
    checked++
    if ((await abandon(a.passId, at)).abandoned) abandoned++
  }
  return { abandoned, checked }
}
