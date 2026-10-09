'use client'

import { useActionState } from 'react'
import { confirmResetAction, loginAction, requestResetAction, volunteerAction, type LoginState, type ResetState, type VolunteerState } from '@/app/admin/login/actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="fld">
        <label htmlFor="email">Organiser email</label>
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
          <label htmlFor="reset-email">Organiser email</label>
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
          <label htmlFor="confirm-email">Organiser email</label>
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

/** Volunteers: email, then the code it brings. No password. */
export function VolunteerForm() {
  const [state, action, pending] = useActionState<VolunteerState, FormData>(volunteerAction, null)
  const codeStep = state?.step === 'code'
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="fld">
        <label htmlFor="vol-email">Your email</label>
        <input id="vol-email" name="email" type="email" autoComplete="email" required className="inp" defaultValue={state?.email ?? ''} readOnly={codeStep} />
        {!codeStep ? <span className="hint">The one an admin added you with. We email you a code; no password needed.</span> : null}
      </div>
      {codeStep ? (
        <div className="fld">
          <label htmlFor="vol-code">6 digit code from your email</label>
          <input id="vol-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="inp inp-num" />
        </div>
      ) : null}
      {state?.message ? (
        <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'copy' : 'err-text'}>
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? 'WAIT' : codeStep ? 'SIGN IN >' : 'EMAIL ME A CODE >'}
      </button>
      {codeStep ? (
        <a href="/admin/login?as=volunteer" className="hint">
          Wrong email, or no code after a few minutes? Start again.
        </a>
      ) : null}
    </form>
  )
}
