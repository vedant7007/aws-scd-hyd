'use client'

import { useActionState, useState } from 'react'
import { notifyOpenAction,
  registrationSwitchAction, sessionCapacityAction, type ActionState } from '@/app/admin/(secure)/actions'
import { CONFIRM_CLOSE } from '@/lib/registration/reasons'

/**
 * The registration switch. Opening is one click. Closing asks for the word
 * to be typed first, because closing by accident during a promotion push
 * would be expensive and there is no undo for the registrations not made.
 */
export function RegistrationSwitch({ open }: { open: boolean }) {
  const [state, action, pending] = useActionState(registrationSwitchAction, null as ActionState)
  const [typed, setTyped] = useState('')

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="open" value={open ? 'false' : 'true'} />
      {open ? (
        <div className="fld">
          <label htmlFor="confirm-close">
            Type {CONFIRM_CLOSE} to close registration
          </label>
          <input id="confirm-close" name="confirm" className="inp inp-num" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      ) : null}
      <button type="submit" className={open ? 'btn btn-warn self-start' : 'btn btn-primary self-start'} disabled={pending || (open && typed.trim().toUpperCase() !== CONFIRM_CLOSE)}>
        {pending ? 'SAVING' : open ? 'CLOSE REGISTRATION' : 'OPEN REGISTRATION'}
      </button>
      {state ? (
        <p role="status" className={state.ok ? 'copy' : 'err-text'}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

/** One session's seat count. Lowering it under the seats already held is refused by the server, with the count. */
export function SessionCapacityForm({ sessionId, current }: { sessionId: string; current: number | null }) {
  const [state, action, pending] = useActionState(sessionCapacityAction, null as ActionState)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="fld w-[140px]">
        <label htmlFor={`cap-${sessionId}`}>Seats</label>
        <input id={`cap-${sessionId}`} name="capacity" type="number" inputMode="numeric" min={0} max={2000} step={1} className="inp inp-num" defaultValue={current ?? ''} placeholder="-" />
      </div>
      <button type="submit" className="btn btn-sm" disabled={pending}>
        {pending ? 'SAVING' : 'SET'}
      </button>
      {state ? (
        <p role="status" className={state.ok ? 'copy w-full' : 'err-text w-full'}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

/** Mails the notify list that registration is open. Type SEND first: it goes to real people. */
export function NotifyOpenForm({ waiting }: { waiting: number }) {
  const [state, action, pending] = useActionState(notifyOpenAction, null as ActionState)
  const [typed, setTyped] = useState('')
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="fld">
        <label htmlFor="confirm-send">Type SEND to email the {waiting} {waiting === 1 ? 'person' : 'people'} not yet told</label>
        <input id="confirm-send" name="confirm" className="inp inp-num" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary self-start" disabled={pending || waiting === 0 || typed.trim().toUpperCase() !== 'SEND'}>
        {pending ? 'SENDING' : 'EMAIL: REGISTRATIONS ARE OPEN'}
      </button>
      {state ? (
        <p role="status" className={state.ok ? 'copy' : 'err-text'}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
