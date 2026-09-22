'use server'

import { redirect } from 'next/navigation'
import { finishPasswordReset, signIn, signOut, startPasswordReset } from '@/lib/auth/admin'

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
