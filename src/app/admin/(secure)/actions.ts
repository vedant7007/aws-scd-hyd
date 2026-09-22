'use server'

import { revalidatePath } from 'next/cache'
import { slots as fallbackSlots } from '@/content/event'
import { formatInr } from '@/content/passes'
import { trackName } from '@/content/sessions'
import { tracks } from '@/content/tracks'
import { createCrewAccount, deleteCrewAccount, forgetSessions, requireAdmin } from '@/lib/auth/admin'
import { addUser, removeUser, setRole } from '@/lib/auth/crew'
import { normalisePassId } from '@/lib/db/keys'
import { getConfig } from '@/lib/db/queries'
import type { CrewRole, Track } from '@/lib/db/types'
import { adminReinstate, adminReject, adminVerify, changeSelection, releaseSessions, sendSessionsLive } from '@/lib/registration/flow'
import { CONFIRM_CLOSE, rejectionText } from '@/lib/registration/reasons'
import { ensureEarlyBirdCounter, setRegistrationOpen, setTrackRoom } from '@/lib/registration/state'

/**
 * Amendment 1 section 6. Every action resolves the admin first, so the
 * email in the log is the one that clicked. Each transition is conditional
 * on the current state, so two admins (or one, twice) acting on the same
 * record produce one change and one email; the second learns it was done.
 *
 * requireAdmin is the guard: a volunteer session is redirected before any
 * line below it runs, whatever the UI showed.
 */
export type ActionState = { ok: boolean; message: string } | null

const id = (formData: FormData) => normalisePassId(String(formData.get('passId') ?? '')) ?? ''

export async function verifyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const passId = id(formData)
  const out = await adminVerify(passId, email)
  revalidatePath('/admin')
  if (!out.ok) return { ok: false, message: `${passId} is not waiting for verification. Someone may have got there first.` }
  return { ok: true, message: `${passId} verified. Confirmation ${out.emailed ? 'sent' : 'not sent (reserved address, or a send failure the reconcile run will retry)'}.` }
}

export async function rejectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const passId = id(formData)
  const reason = rejectionText(String(formData.get('reasonCode') ?? ''), String(formData.get('reason') ?? ''))
  if (!reason) return { ok: false, message: 'Pick a reason. "Other" needs a note for the student.' }
  const out = await adminReject(passId, email, reason)
  revalidatePath('/admin')
  if (!out.ok) return { ok: false, message: `${passId} is not waiting for verification.` }
  return { ok: true, message: `${passId} rejected: ${reason}. The student was ${out.emailed ? 'emailed' : 'not emailed (reserved address or send failure)'}.` }
}

export async function reinstateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const passId = id(formData)
  const utr = String(formData.get('utr') ?? '')
  const out = await adminReinstate(passId, email, utr)
  revalidatePath('/admin')
  if (!out.ok) {
    if (out.reason === 'track-full') return { ok: false, message: `${passId} NOT reinstated: the ${trackName(out.track)} track is now full. Offer a refund or a different track.` }
    if (out.reason === 'utr-used') return { ok: false, message: `That UTR is already used by another registration, or is not 12 digits. Nothing changed.` }
    return { ok: false, message: `${passId} is not abandoned. Nothing changed.` }
  }
  const priced =
    out.priced === 'early'
      ? ` Early bird place re-claimed, so it stays at ${formatInr(out.attendee.amountPaise)}.`
      : out.priced === 'full'
        ? ` The early bird pool is empty now, so it is back at the full price, ${formatInr(out.attendee.amountPaise)}. Tell the student if they paid less.`
        : ''
  return { ok: true, message: `${passId} reinstated and back in the queue.${priced} Receipt ${out.emailed ? 'sent' : 'not sent'}.` }
}

export async function releaseSessionsAction(): Promise<ActionState> {
  const { email } = await requireAdmin()
  const out = await releaseSessions(email)
  revalidatePath('/admin')
  return { ok: true, message: `Sessions released. Email 3: ${out.sent} sent, ${out.skipped} already had it or are reserved, ${out.failed} failed (run again to retry).` }
}

export async function resendSessionsLiveAction(): Promise<ActionState> {
  await requireAdmin()
  const out = await sendSessionsLive()
  revalidatePath('/admin')
  return { ok: true, message: `Email 3 run: ${out.sent} sent, ${out.skipped} skipped, ${out.failed} failed.` }
}

export async function changeSelectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const passId = id(formData)
  const picks: Record<string, string> = {}
  for (const [k, v] of formData.entries()) if (k.startsWith('slot:') && typeof v === 'string' && v) picks[k.slice(5)] = v
  const out = await changeSelection(passId, email, picks)
  revalidatePath('/admin')
  if (!out.ok) {
    if (out.reason === 'invalid') return { ok: false, message: out.message }
    if (out.reason === 'filled') return { ok: false, message: `${out.sessionId} is full. Nothing changed.` }
    return { ok: false, message: `${passId} is not in SESSIONS_SELECTED, or changed underneath you. Nothing changed.` }
  }
  return { ok: true, message: `${passId} moved: ${out.released} seat(s) released, ${out.claimed} claimed, in one transaction.` }
}

/* ---- settings ------------------------------------------------------------- */

export async function registrationSwitchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const open = String(formData.get('open') ?? '') === 'true'
  if (!open && String(formData.get('confirm') ?? '').trim().toUpperCase() !== CONFIRM_CLOSE) {
    return { ok: false, message: `Type ${CONFIRM_CLOSE} to confirm. Registration is still open.` }
  }
  if (open) await ensureEarlyBirdCounter()
  await setRegistrationOpen(open, email)
  revalidatePath('/admin')
  revalidatePath('/admin/settings')
  return {
    ok: true,
    message: open
      ? 'Registration is open. New registrations are accepted from this moment.'
      : 'Registration is closed. Nobody new can start; anyone already paying can still submit a UTR until their hold lapses, and verification, session release and selection keep working.',
  }
}

export async function trackRoomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const track = String(formData.get('track') ?? '') as Track
  const roomId = String(formData.get('roomId') ?? '')
  if (!tracks.some((t) => t.id === track)) return { ok: false, message: 'Pick a track.' }
  const slotIds = ((await getConfig())?.slots ?? fallbackSlots).map((s) => s.id)
  const out = await setTrackRoom(track, roomId, email, slotIds)
  revalidatePath('/admin')
  revalidatePath('/admin/settings')
  if (!out.ok) {
    if (out.reason === 'no-such-room') return { ok: false, message: 'That is not a track room.' }
    return {
      ok: false,
      message: `REFUSED: ${trackName(track)} already has ${out.registered} registered, and that room sells ${out.ceiling}. A ceiling below the registered count would oversell the room. Nothing changed.`,
    }
  }
  return { ok: true, message: `${trackName(track)} now runs in ${roomId}: ceiling ${out.ceiling}, and its four sessions carry the room and capacities.` }
}

/* ---- crew --------------------------------------------------------------- */

const roleOf = (v: unknown): CrewRole | null => (v === 'admin' || v === 'volunteer' ? v : null)

/**
 * Adds a crew account: the table row, then the Cognito sign-in account with
 * no password anyone sees. The person sets their own through "Forgot
 * password" on the sign-in page. Nothing here prints, logs or returns one.
 */
export async function addUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const target = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = roleOf(formData.get('role'))
  if (!role) return { ok: false, message: 'Pick a role.' }
  const out = await addUser(target, role, email)
  if (!out.ok) {
    if (out.reason === 'exists') return { ok: false, message: `${target} is already on the crew list. Change their role below instead.` }
    return { ok: false, message: 'That is not an email address.' }
  }
  const account = await createCrewAccount(target)
  forgetSessions()
  revalidatePath('/admin/users')
  return {
    ok: true,
    message: `${target} added as ${role}. ${account.created ? 'Their sign-in account is created; they set their own password with "Forgot password" on the sign-in page.' : 'Their sign-in account already existed.'}`,
  }
}

export async function setRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const target = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = roleOf(formData.get('role'))
  if (!role) return { ok: false, message: 'Pick a role.' }
  const out = await setRole(target, role, email)
  forgetSessions()
  revalidatePath('/admin/users')
  if (!out.ok) {
    if (out.reason === 'last-admin') return { ok: false, message: `REFUSED: ${target} is the last admin. Make someone else an admin first. An event with no admin cannot be run.` }
    return { ok: false, message: `${target} is not on the crew list.` }
  }
  return { ok: true, message: `${target} is now ${role}.` }
}

export async function removeUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const target = String(formData.get('email') ?? '').trim().toLowerCase()
  const out = await removeUser(target, email)
  forgetSessions()
  revalidatePath('/admin/users')
  if (!out.ok) {
    if (out.reason === 'last-admin') return { ok: false, message: `REFUSED: ${target} is the last admin. Make someone else an admin first.` }
    return { ok: false, message: `${target} is not on the crew list.` }
  }
  await deleteCrewAccount(target)
  return { ok: true, message: `${target} removed. Their sign-in account is deleted too.` }
}
