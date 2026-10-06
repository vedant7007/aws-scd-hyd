import { createHash } from 'node:crypto'
import { holdMinutes } from '../../content/payment'
import { newPassId } from '../db/keys'
import { getAttendee, listAttendees } from '../db/queries'
import type { Attendee, AttendeeSource } from '../db/types'
import { isReservedAddress, sendEmail } from '../email/send'
import { confirmation, receipt, rejection, type GroupNote } from '../email/templates'
import { amountFor } from '../tickets/pricing'
import { abandon, createGroupHold, createHold, dropGroupHold, groupOf, markSent, moveHold, reject, submitUtr, verify, type HoldOutcome } from './state'
import type { GroupInput, HoldInput } from './validate'

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
    // Switched from a group to one person: the group's hold goes, then a fresh one is made.
    if (before && before.state === 'AWAITING_PAYMENT' && before.submissionKeyHash === keyHash && before.groupId) {
      await dropGroupHold(before, keyHash)
    } else if (before && before.state === 'AWAITING_PAYMENT' && before.submissionKeyHash === keyHash) {
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

/* ---- group passes ------------------------------------------------------ */

export type GroupHeld = { ok: true; leader: Attendee; members: Attendee[] } | { ok: false; reason: 'full'; sessionId: string }

/**
 * A group's payment step: one record per person, all on the leader's
 * pass id as groupId, all seats claimed together. Each person's amount is
 * the pass price less the group discount, decided here and locked in; the
 * leader's record carries the total, which is what the leader pays. Going
 * back to edit drops the group's earlier hold and makes a fresh one, keeping
 * the old clock so editing never buys more time.
 */
export async function placeGroupHold(group: GroupInput, submissionKey: string, previousPassId: string | undefined, source: AttendeeSource): Promise<GroupHeld> {
  const size = group.members.length
  const amountPaise = amountFor(group.tier, size).amountPaise
  const keyHash = hashKey(submissionKey)
  const at = new Date().toISOString()
  let holdUntil = new Date(Date.now() + holdMinutes * 60_000).toISOString()

  if (previousPassId) {
    const before = await getAttendee(previousPassId)
    if (before && before.state === 'AWAITING_PAYMENT' && before.submissionKeyHash === keyHash) {
      if ((await dropGroupHold(before, keyHash)) && before.holdUntil && before.holdUntil > at) holdUntil = before.holdUntil
    }
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const ids = group.members.map(() => newPassId())
    const leaderId = ids[0]!
    const recs = group.members.map((m, i) => ({
      passId: ids[i]!,
      rec: {
        ...m,
        tier: group.tier,
        name: [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' '),
        amountPaise,
        submissionKeyHash: keyHash,
        holdUntil,
        source,
        groupId: leaderId,
        groupSize: size,
        ...(i === 0 ? { groupMembers: ids.slice(1), groupTotalPaise: amountPaise * size } : {}),
      },
    }))
    const out = await createGroupHold(recs)
    if (out.ok) return { ok: true, leader: out.attendees[0]!, members: out.attendees.slice(1) }
    if (out.reason === 'full') return out
  }
  throw new Error('placeGroupHold: four pass id collisions in a row, which should not be possible')
}

/** What each person's mail says about the group, or nothing outside one. */
function noteFor(a: Attendee, all: Attendee[]): GroupNote | undefined {
  if (!a.groupId || all.length < 2) return undefined
  const leader = all[0]!
  return {
    leaderName: leader.name,
    size: a.groupSize ?? all.length,
    isLeader: a.passId === leader.passId,
    totalPaise: leader.groupTotalPaise ?? all.reduce((n, x) => n + x.amountPaise, 0),
    members: all.map((x) => ({ name: x.name, passId: x.passId })),
  }
}

/* ---- the UTR ----------------------------------------------------------- */

export type Submitted = { ok: true; attendee: Attendee; emailed: boolean } | { ok: false; reason: 'wrong-state' | 'utr-used' }

/** UTR and screenshot in, PENDING_VERIFICATION, email 1 out with the pass id. */
export async function submitPayment(passId: string, utr: string, screenshotKey: string): Promise<Submitted> {
  const out = await submitUtr(passId, utr, screenshotKey)
  if (!out.ok) return out
  // In a group everyone gets their own receipt with their own pass id.
  const all = await groupOf(out.attendee)
  let emailed = false
  for (const a of all) {
    const sent = await mail(a, receipt(a, noteFor(a, all)), 'receiptSentAt')
    if (a.passId === passId) emailed = sent
  }
  return { ok: true, attendee: out.attendee, emailed }
}

/* ---- admin ------------------------------------------------------------- */

export async function adminVerify(passId: string, by: string): Promise<{ ok: true; emailed: boolean } | { ok: false; reason: 'wrong-state' }> {
  const out = await verify(passId, by)
  if (!out.ok) return out
  // Only the call that moved the record sends. A second click never gets here.
  const all = [out.attendee, ...out.members]
  let emailed = false
  for (const a of all) {
    const sent = await mail(a, confirmation(a, noteFor(a, all)), 'confirmationSentAt')
    if (a.passId === passId) emailed = sent
  }
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

/* ---- the sweep --------------------------------------------------------- */

/**
 * Every AWAITING_PAYMENT record whose hold has lapsed is deleted and gives
 * its seats back, each in its own transaction. No email: a student who
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
