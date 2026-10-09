'use server'

import { redirect } from 'next/navigation'
import { finishPasswordReset, signIn, signOut, startPasswordReset } from '@/lib/auth/admin'
import { sendVolunteerCode, verifyVolunteerCode } from '@/lib/auth/volunteer'

export type LoginState = { message: string } | null

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const result = await signIn(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''))
  if (!result.ok) return { message: result.message }
  redirect(result.role === 'admin' ? '/admin' : '/admin/scan')
}

export async function signOutAction(): Promise<void> {
  await signOut()
  redirect('/admin/login')
}

export type ResetState = { ok: boolean; message: string; step: 'code' | 'done' } | null

/**
 * Forgot password, in two steps. Cognito emails the code; the new password
 * goes from the form straight to Cognito. Neither the code nor the password
 * is kept, logged or returned by anything here.
 */
export async function requestResetAction(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const out = await startPasswordReset(String(formData.get('email') ?? ''))
  if (!out.ok) return { ok: false, message: out.message, step: 'code' }
  return { ok: true, message: 'If that address has an account, a code is on its way to it. Enter it below with your new password.', step: 'code' }
}

export async function confirmResetAction(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const out = await finishPasswordReset(String(formData.get('email') ?? ''), String(formData.get('code') ?? ''), String(formData.get('password') ?? ''))
  if (!out.ok) return { ok: false, message: out.message, step: 'code' }
  return { ok: true, message: 'Password set. Sign in with it.', step: 'done' }
}

export type VolunteerState = { step: 'email' | 'code'; email: string; message: string; ok: boolean } | null

/**
 * Volunteer sign in, two steps on one form: the email asks for a code, the
 * code signs them in and sends them to the scanner. The reply after the
 * email step is the same whether or not the address is a volunteer.
 */
export async function volunteerAction(prev: VolunteerState, formData: FormData): Promise<VolunteerState> {
  const email = String(formData.get('email') ?? '').trim()
  const code = String(formData.get('code') ?? '')
  if (prev?.step === 'code' && code) {
    const out = await verifyVolunteerCode(email, code)
    if (!out.ok) return { step: 'code', email, message: out.message, ok: false }
    redirect('/admin/scan')
  }
  const sent = await sendVolunteerCode(email)
  if (!sent.ok) return { step: 'email', email, message: sent.message, ok: false }
  return { step: 'code', email, message: `If ${email} is on the volunteer list, a 6 digit code is on its way to it. Check spam too.`, ok: true }
}
