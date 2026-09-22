import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { sessionsReleased as contentReleased, slots } from '../../content/event'
import { holdMinutes } from '../../content/payment'
import { earlyBirdPrice, tracksAllowedFor } from '../../content/passes'
import { sessionIdFor } from '../../content/sessions'
import { tracks } from '../../content/tracks'
import { ddb, tableName } from '../db/client'
import { keys, newPassId } from '../db/keys'
import { getAllSessions, getAttendee, getAttendeeWithSeats, getConfig, listAttendees } from '../db/queries'
import type { Pick as SessionPick } from '../db/seats'
import type { Attendee, Track } from '../db/types'
import { isReservedAddress, sendEmail } from '../email/send'
import { confirmation, passReady, receipt, rejection, sessionsLive, type ChosenSession } from '../email/templates'
import { amountFor } from '../tickets/pricing'
import { paymentMode } from '../tickets/mode'
import { createOrder } from '../tickets/razorpay'
import {
  abandon,
  adminChangeSelection,
  earlyBirdLeft,
  markSent,
  registerStepOne,
  reinstate,
  reject,
  selectSessions,
  submitUtr,
  verify,
  type ChangeOutcome,
  type ReinstateOutcome,
  type Registration,
  type SelectOutcome,
} from './state'

/**
 * One email, then the mark that says it went. A reserved (seeded) address is
 * skipped silently; any other failure is logged and the mark is left absent,
 * so the reconcile run can retry what is owed.
 */
type Deliver = typeof sendEmail

async function mail(a: Attendee, body: Omit<Parameters<typeof sendEmail>[0], 'to'>, field: Parameters<typeof markSent>[1], deliver: Deliver = sendEmail): Promise<boolean> {
  if (isReservedAddress(a.email)) return false
  try {
    await deliver({ to: a.email, ...body })
    await markSent(a.passId, field)
    return true
  } catch (err) {
    console.error(`[email] ${field} for ${a.passId} failed, left owed`, err)
    return false
  }
}

/* ---- step one ---------------------------------------------------------- */

export type StepOne =
  | {
      ok: true
      attendee: Attendee
      duplicate: boolean
      placeholder: boolean
      /** The 50th early bird place went a moment before this record: charged full price, and the pay page says so. */
      earlyBirdMissed: boolean
      order?: { orderId: string; keyId: string; currency: string }
    }
  | { ok: false; reason: 'track-full'; track: Track }
  | { ok: false; reason: 'provider'; message: string }

/**
 * Amendment 1 section 2.1. Mints the pass id, decides the amount from
 * content, and creates the AWAITING_PAYMENT record against its track
 * counter. In Razorpay mode the provider order is created first (an order
 * with no record is harmless, a record with no order can never be paid).
 *
 * Early bird: if the pool shows a place, the discounted price is offered
 * and the place claimed in the record's own transaction. If that claim
 * fails because the last place went a moment earlier, the same registration
 * is retried once at full price (a fresh provider order in Razorpay mode)
 * and the record is marked so the pay page can say what happened. The
 * price a record carries is the price it was charged; nothing recomputes
 * it later.
 */
export async function stepOne(reg: Registration, submissionKey: string): Promise<StepOne> {
  const mode = paymentMode()
  const full = amountFor(reg.tier)
  const holdUntil = new Date(Date.now() + holdMinutes * 60_000).toISOString()

  let earlyBird = !full.placeholder && (await earlyBirdLeft()) > 0
  let earlyBirdMissed = false

  for (let attempt = 0; attempt < 4; attempt++) {
    const price = earlyBird
      ? { amountPaise: earlyBirdPrice(full.amountPaise), earlyBird: { listPricePaise: full.amountPaise } }
      : { amountPaise: full.amountPaise, earlyBirdMissed }
    const passId = newPassId()

    let order: Awaited<ReturnType<typeof createOrder>> | undefined
    if (mode === 'razorpay') {
      try {
        order = await createOrder({ ticketRef: passId, amountPaise: price.amountPaise, tier: reg.tier })
      } catch (err) {
        console.error('[register] order creation failed', err)
        return { ok: false, reason: 'provider', message: 'The payment provider did not respond. Nothing was charged. Try again.' }
      }
    }

    const out = await registerStepOne(passId, reg, { mode, ...price, orderId: order?.orderId, holdUntil, submissionKey })
    if (out.ok) {
      return {
        ok: true,
        attendee: out.attendee,
        duplicate: out.duplicate,
        placeholder: full.placeholder,
        earlyBirdMissed: out.attendee.earlyBirdMissed === true,
        ...(order ? { order: { orderId: order.orderId, keyId: order.keyId, currency: order.currency } } : {}),
      }
    }
    if (out.reason === 'early-bird-out') {
      // The pool emptied between the read and the write. Once more, at full price, and say so.
      earlyBird = false
      earlyBirdMissed = true
      continue
    }
    if (out.reason !== 'id-collision') return out
  }
  throw new Error('step one could not complete in four attempts, which should not be possible')
}

/* ---- step two ---------------------------------------------------------- */

export const UTR = /^\d{12}$/

export type StepTwo = { ok: true; attendee: Attendee; emailed: boolean } | { ok: false; reason: 'wrong-state' | 'utr-used' | 'bad-utr' }

/** Amendment 1 section 2.2. UTR and screenshot in, PENDING_VERIFICATION, email 1 out. */
export async function stepTwo(passId: string, utr: string, screenshotKey: string): Promise<StepTwo> {
  const clean = utr.replace(/\s+/g, '')
  if (!UTR.test(clean)) return { ok: false, reason: 'bad-utr' }
  const out = await submitUtr(passId, clean, screenshotKey)
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
  // The receipt goes out again on reinstate, at whatever price the record now carries.
  const clean = utr.replace(/\s+/g, '')
  if (!UTR.test(clean)) return { ok: false, reason: 'utr-used' }
  const out = await reinstate(passId, by, clean)
  if (!out.ok) return out
  const emailed = await mail(out.attendee, receipt(out.attendee), 'receiptSentAt')
  return { ...out, emailed }
}

/**
 * Amendment 1 section 3, email 3. Flips the release flag, then mails every
 * VERIFIED attendee who has not had it. The mark is written per attendee
 * right after each send, so a run that dies halfway resumes from where it
 * stopped on the next call and a run repeated sends nothing twice.
 */
export async function releaseSessions(by: string): Promise<{ sent: number; skipped: number; failed: number }> {
  const at = new Date().toISOString()
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.config(),
      UpdateExpression: 'SET sessionsReleased = :t, sessionsReleasedAt = if_not_exists(sessionsReleasedAt, :at), sessionsReleasedBy = if_not_exists(sessionsReleasedBy, :by)',
      ExpressionAttributeValues: { ':t': true, ':at': at, ':by': by },
    }),
  )
  return sendSessionsLive()
}

/**
 * The mailing half of a release, callable again to finish an interrupted
 * run. `deliver` exists so the acceptance suite can make a send fail partway
 * and prove the run resumes; production never passes it.
 */
export async function sendSessionsLive(deliver: Deliver = sendEmail): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0
  let skipped = 0
  let failed = 0
  for (const a of await listAttendees()) {
    if (a.state !== 'VERIFIED' || a.sessionsReleaseEmailSentAt) {
      skipped++
      continue
    }
    if (isReservedAddress(a.email)) {
      skipped++
      continue
    }
    if (await mail(a, sessionsLive(a), 'sessionsReleaseEmailSentAt', deliver)) sent++
    else failed++
  }
  return { sent, skipped, failed }
}

export const sessionsAreReleased = async () => (await getConfig())?.sessionsReleased ?? contentReleased

/* ---- sessions ---------------------------------------------------------- */

export type PickInput = Record<string, string>

export type Validated = { ok: true; picks: SessionPick[] } | { ok: false; message: string; field?: string }

/**
 * Amendment 2 section 3, server side. Exactly one session per slot, every
 * slot filled, every session real, every track inside the tier's allowance
 * read from passes.ts: the home track plus (tracksAllowed - 1) others.
 */
export function validatePicks(attendee: Pick<Attendee, 'tier' | 'homeTrack'>, input: PickInput): Validated {
  const picks: SessionPick[] = []
  const chosenTracks = new Set<Track>()
  for (const slot of slots) {
    const sessionId = input[slot.id]
    if (typeof sessionId !== 'string' || !sessionId) return { ok: false, field: slot.id, message: `Pick a session for ${slot.label}.` }
    const track = tracks.map((t) => t.id).find((t) => sessionIdFor(slot.id, t) === sessionId)
    if (!track) return { ok: false, field: slot.id, message: `${sessionId} is not a session in ${slot.label}.` }
    picks.push({ sessionId, slotId: slot.id, track })
    chosenTracks.add(track)
  }
  const extraKeys = Object.keys(input).filter((k) => !slots.some((s) => s.id === k))
  if (extraKeys.length) return { ok: false, message: `${extraKeys.join(', ')}: not a slot.` }
  const allowed = tracksAllowedFor(attendee.tier)
  const others = [...chosenTracks].filter((t) => t !== attendee.homeTrack)
  if (others.length > allowed - 1) {
    return { ok: false, message: allowed === 1 ? 'Your pass covers your own track only.' : `Your pass covers your own track and ${allowed - 1} other${allowed - 1 === 1 ? '' : 's'}.` }
  }
  return { ok: true, picks }
}

export type Choose = SelectOutcome & { emailed?: boolean }

/** VERIFIED to SESSIONS_SELECTED with the four seats, then email 4. */
export async function chooseSessions(passId: string, picks: SessionPick[]): Promise<Choose> {
  const out = await selectSessions(passId, picks)
  if (!out.ok) return out
  const emailed = await mail(out.attendee, passReady(out.attendee, await chosen(passId)), 'passReadySentAt')
  return { ...out, emailed }
}

/** The four sessions a pass holds, in slot order, with their slot for display. */
export async function chosen(passId: string): Promise<ChosenSession[]> {
  const [{ seats }, all] = await Promise.all([getAttendeeWithSeats(passId), getAllSessions()])
  const bySession = new Map(all.filter((s): s is NonNullable<typeof s> => Boolean(s)).map((s) => [s.sessionId, s]))
  return slots.flatMap((slot) => {
    const seat = seats.find((s) => s.slotId === slot.id)
    const session = seat ? bySession.get(seat.sessionId) : undefined
    return session ? [{ slot, session }] : []
  })
}

export async function changeSelection(passId: string, by: string, input: PickInput): Promise<ChangeOutcome | { ok: false; reason: 'invalid'; message: string }> {
  const attendee = await getAttendee(passId)
  if (!attendee) return { ok: false, reason: 'wrong-state' }
  const v = validatePicks(attendee, input)
  if (!v.ok) return { ok: false, reason: 'invalid', message: v.message }
  return adminChangeSelection(passId, by, v.picks)
}

/* ---- the sweep --------------------------------------------------------- */

/**
 * Amendment 1 section 2.3. Every AWAITING_PAYMENT record whose hold has
 * lapsed goes to ABANDONED, its track counter down by one, each in its own
 * transaction. No email: a student who never paid should not be chased.
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
