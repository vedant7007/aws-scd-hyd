'use client'

import { useActionState } from 'react'
import { confirmResetAction, loginAction, requestResetAction, type LoginState, type ResetState } from '@/app/admin/login/actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="fld">
        <label htmlFor="email">Crew email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="inp" />
      </div>
      <div className="fld">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="inp" />
      </div>
      {state?.message ? (
        <p role="alert" className="err-text">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? 'CHECKING' : 'SIGN IN >'}
      </button>
    </form>
  )
}

export function ResetForm() {
  const [requested, request, requesting] = useActionState<ResetState, FormData>(requestResetAction, null)
  const [confirmed, confirm, confirming] = useActionState<ResetState, FormData>(confirmResetAction, null)

  if (confirmed?.ok && confirmed.step === 'done') {
    return (
      <p role="status" className="copy">
        {confirmed.message}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={request} className="flex flex-col gap-4">
        <span className="eye">STEP 01 OF 02</span>
        <div className="fld">
          <label htmlFor="reset-email">Crew email</label>
          <input id="reset-email" name="email" type="email" autoComplete="username" required className="inp" />
        </div>
        {requested ? (
          <p role="status" className={requested.ok ? 'copy' : 'err-text'}>
            {requested.message}
          </p>
        ) : null}
        <button type="submit" className="btn self-start" disabled={requesting}>
          {requesting ? 'SENDING' : 'SEND ME A CODE'}
        </button>
      </form>
      <form action={confirm} className="flex flex-col gap-4 border-t border-line-soft pt-6">
        <span className="eye">STEP 02 OF 02</span>
        <div className="fld">
          <label htmlFor="confirm-email">Crew email</label>
          <input id="confirm-email" name="email" type="email" autoComplete="username" required className="inp" />
        </div>
        <div className="fld">
          <label htmlFor="confirm-code">Code from the email</label>
          <input id="confirm-code" name="code" inputMode="numeric" autoComplete="one-time-code" required className="inp inp-num" />
        </div>
        <div className="fld">
          <label htmlFor="confirm-password">New password</label>
          <input id="confirm-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="inp" />
          <p className="hint">At least eight characters, with upper and lower case, a number and a symbol.</p>
        </div>
        {confirmed && !confirmed.ok ? (
          <p role="alert" className="err-text">
            {confirmed.message}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary self-start" disabled={confirming}>
          {confirming ? 'SAVING' : 'SET PASSWORD >'}
        </button>
      </form>
    </div>
  )
}
