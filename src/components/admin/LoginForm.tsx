'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '@/app/admin/login/actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null)

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-step--1 text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="field"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-step--1 text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>

      {state?.message ? (
        <p role="alert" className="text-step--1 text-accent">
          {state.message}
        </p>
      ) : null}

      <div>
        <button type="submit" className="cta" disabled={pending}>
          {pending ? 'Checking' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
