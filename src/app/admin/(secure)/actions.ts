'use server'

import { revalidatePath } from 'next/cache'
import { programSession } from '@/content/program'
import { createCrewAccount, deleteCrewAccount, forgetSessions, requireAdmin } from '@/lib/auth/admin'
import { addUser, removeUser, setRole } from '@/lib/auth/crew'
import { normalisePassId } from '@/lib/db/keys'
import type { CrewRole } from '@/lib/db/types'
import { adminReject, adminVerify } from '@/lib/registration/flow'
import { CONFIRM_CLOSE, rejectionText } from '@/lib/registration/reasons'
import { deleteScreenshots } from '@/lib/registration/screenshots'
import { deleteRegistration, setRegistrationOpen, setSessionCapacity } from '@/lib/registration/state'
import { mailNotifyListOpen } from '@/lib/notify-open'

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

/** Deletes a registration for good. Typing DELETE is the confirmation; nothing about it can be undone. */
export async function deleteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const passId = id(formData)
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return { ok: false, message: 'Type DELETE to confirm. Nothing was deleted.' }
  const out = await deleteRegistration(passId)
  if (!out.ok) return { ok: false, message: `${passId} changed or is already gone. Nothing was deleted; refresh and look again.` }
  let shots = 0
  for (const gone of out.deleted) {
    try {
      shots += await deleteScreenshots(gone)
    } catch (err) {
      console.error(`[admin] screenshots for ${gone} not deleted`, err)
    }
  }
  console.info(`[admin] ${email} deleted ${passId} (${out.attendee.state}), ${shots} screenshot(s)`)
  revalidatePath('/admin')
  const n = out.deleted.length
  return { ok: true, message: n > 1 ? `The whole group of ${n} (${out.deleted.join(', ')}) deleted, their seats given back.` : `${passId} deleted, its seats given back.` }
}

/* ---- settings ------------------------------------------------------------- */

export async function registrationSwitchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const open = String(formData.get('open') ?? '') === 'true'
  if (!open && String(formData.get('confirm') ?? '').trim().toUpperCase() !== CONFIRM_CLOSE) {
    return { ok: false, message: `Type ${CONFIRM_CLOSE} to confirm. Registration is still open.` }
  }
  await setRegistrationOpen(open, email)
  revalidatePath('/admin')
  revalidatePath('/admin/settings')
  return {
    ok: true,
    message: open
      ? 'Registration is open. New registrations are accepted from this moment.'
      : 'Registration is closed. Nobody new can start; anyone already paying can still submit a UTR until their hold lapses, and verification keeps working.',
  }
}

export async function sessionCapacityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email } = await requireAdmin()
  const sessionId = String(formData.get('sessionId') ?? '')
  const s = programSession(sessionId)
  if (!s) return { ok: false, message: 'Pick a session.' }
  const capacity = Number(String(formData.get('capacity') ?? '').trim())
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 2000) return { ok: false, message: 'A seat count is a whole number from 0 to 2000.' }
  const out = await setSessionCapacity(sessionId, capacity, email)
  revalidatePath('/admin')
  revalidatePath('/admin/settings')
  if (!out.ok) {
    return { ok: false, message: `REFUSED: ${out.taken} seats in ${s.title} are already held, and ${capacity} would put them over the limit. Nothing changed.` }
  }
  return { ok: true, message: `${s.code} now sells ${capacity} seats.` }
}

export async function notifyOpenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'SEND') return { ok: false, message: 'Type SEND to confirm. Nothing was sent.' }
  const out = await mailNotifyListOpen()
  revalidatePath('/admin/notify')
  if (!out.ok) return { ok: false, message: out.message }
  return {
    ok: true,
    message: `Sent to ${out.sent}. ${out.already} had it already, ${out.skipped} skipped (test addresses)${out.failed ? `, ${out.failed} FAILED: press again to retry just those` : ''}.`,
  }
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
    message:
      role === 'volunteer'
        ? `${target} added as volunteer. They sign in on the Volunteer tab of the sign-in page with just this email; a code is emailed to them.`
        : `${target} added as admin. ${account.created ? 'Their sign-in account is created; they set their own password with "Forgot password" on the sign-in page.' : 'Their sign-in account already existed.'}`,
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
    if (out.reason === 'owner') return { ok: false, message: `REFUSED: ${target} is the owner and always stays an admin.` }
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
    if (out.reason === 'owner') return { ok: false, message: `REFUSED: ${target} is the owner and always stays an admin.` }
    if (out.reason === 'last-admin') return { ok: false, message: `REFUSED: ${target} is the last admin. Make someone else an admin first.` }
    return { ok: false, message: `${target} is not on the crew list.` }
  }
  await deleteCrewAccount(target)
  return { ok: true, message: `${target} removed. Their sign-in account is deleted too.` }
}
