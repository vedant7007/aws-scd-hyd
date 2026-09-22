'use client'

import { useActionState } from 'react'
import { addUserAction, removeUserAction, setRoleAction, type ActionState } from '@/app/admin/(secure)/actions'
import type { CrewRole } from '@/lib/db/types'

const Status = ({ state }: { state: ActionState }) =>
  state ? (
    <p role="status" className={state.ok ? 'copy w-full' : 'err-text w-full'}>
      {state.message}
    </p>
  ) : null

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, null as ActionState)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="fld min-w-0 flex-[1_1_240px]">
        <label htmlFor="new-email">Email</label>
        <input id="new-email" name="email" type="email" className="inp" autoComplete="off" required placeholder="their sign-in email" />
      </div>
      <div className="fld flex-[0_1_180px]">
        <label htmlFor="new-role">Role</label>
        <select id="new-role" name="role" className="inp" defaultValue="volunteer">
          <option value="volunteer">Volunteer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'ADDING' : 'ADD'}
      </button>
      <Status state={state} />
    </form>
  )
}

export function UserRow({ user, self, lastAdmin }: { user: { email: string; role: CrewRole; addedAt: string; addedBy: string }; self: boolean; lastAdmin: boolean }) {
  const [roleState, roleAction, changing] = useActionState(setRoleAction, null as ActionState)
  const [removeState, removeAction, removing] = useActionState(removeUserAction, null as ActionState)
  const other: CrewRole = user.role === 'admin' ? 'volunteer' : 'admin'

  return (
    <div className="flex flex-col gap-3 border-t border-line-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="num text-[14px] text-ink">
            {user.email}
            {self ? <span className="lbl"> · you</span> : null}
          </span>
          <span className="hint">
            added {new Date(user.addedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })} by {user.addedBy}
          </span>
        </span>
        <span className={user.role === 'admin' ? 'pill pill-orange pill-sm' : 'pill pill-violet pill-sm'}>{user.role}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <form action={roleAction}>
          <input type="hidden" name="email" value={user.email} />
          <input type="hidden" name="role" value={other} />
          <button type="submit" className="btn btn-sm" disabled={changing || lastAdmin} title={lastAdmin ? 'The last admin cannot be demoted' : undefined}>
            {changing ? 'SAVING' : `MAKE ${other.toUpperCase()}`}
          </button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="email" value={user.email} />
          <button type="submit" className="btn btn-sm btn-warn" disabled={removing || lastAdmin} title={lastAdmin ? 'The last admin cannot be removed' : undefined}>
            {removing ? 'REMOVING' : 'REMOVE'}
          </button>
        </form>
      </div>
      <Status state={roleState ?? removeState} />
    </div>
  )
}
