'use client'

import { useActionState, useState } from 'react'
import { registrationSwitchAction, trackRoomAction, type ActionState } from '@/app/admin/(secure)/actions'
import type { Track } from '@/lib/db/types'
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

export function TrackRoomForm({ track, current, rooms }: { track: Track; current: string; rooms: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(trackRoomAction, null as ActionState)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="track" value={track} />
      <div className="fld min-w-0 flex-[1_1_260px]">
        <label htmlFor={`room-${track}`}>Room</label>
        <select id={`room-${track}`} name="roomId" className="inp" defaultValue={current}>
          <option value="" disabled>
            Pick a room
          </option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-sm" disabled={pending}>
        {pending ? 'SAVING' : 'MOVE TRACK'}
      </button>
      {state ? (
        <p role="status" className={state.ok ? 'copy w-full' : 'err-text w-full'}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
