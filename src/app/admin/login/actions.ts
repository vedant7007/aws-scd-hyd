'use server'

import { redirect } from 'next/navigation'
import { signIn, signOut } from '@/lib/auth/admin'

export type LoginState = { message: string } | null

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const result = await signIn(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''))
  if (!result.ok) return { message: result.message }
  redirect('/admin')
}

export async function signOutAction(): Promise<void> {
  await signOut()
  redirect('/admin/login')
}
