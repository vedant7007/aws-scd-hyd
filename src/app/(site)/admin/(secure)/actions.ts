'use server'

import { revalidatePath } from 'next/cache'
import { trackName } from '@/content/sessions'
import { requireAdmin } from '@/lib/auth/admin'
import { normalisePassId } from '@/lib/db/keys'
import { adminReinstate, adminReject, adminVerify, changeSelection, releaseSessions, sendSessionsLive } from '@/lib/registration/flow'

/**
 * Amendment 1 section 6. Every action resolves the admin first, so the
 * email in the log is the one that clicked. Each transition is conditional
 * on the current state, so two admins (or one, twice) acting on the same
 * record produce one change and one email; the second learns it was done.
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
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300)
  const out = await adminReject(passId, email, reason)
  revalidatePath('/admin')
  if (!out.ok) return { ok: false, message: `${passId} is not waiting for verification.` }
  return { ok: true, message: `${passId} rejected. The student was ${out.emailed ? 'emailed' : 'not emailed (reserved address or send failure)'}.` }
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
  return { ok: true, message: `${passId} reinstated and back in the queue. Receipt ${out.emailed ? 'sent' : 'not sent'}.` }
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
