import { requireAdmin } from '@/lib/auth/admin'
import { listCrewAudit, listUsers } from '@/lib/auth/crew'
import { AddUserForm, UserRow } from '@/components/admin/Users'

/**
 * Who is on the crew and what they may do. Admin only: a volunteer is
 * redirected by requireAdmin before this loads. Adding someone creates
 * their sign-in account with no password anyone sees; they set their own
 * through "Forgot password" on the sign-in page.
 */
export default async function UsersPage() {
  const { email } = await requireAdmin()
  const [users, audit] = await Promise.all([listUsers(), listCrewAudit(30)])
  const admins = users.filter((u) => u.role === 'admin').length

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// CREW'}</span>
        <h1 className="h1">WHO IS ON THE CREW</h1>
        <p className="lede">
          An admin sees everything and changes anything. A volunteer sees the gate scanner and nothing else: no attendee list, no email
          address, no payment queue, no export, no settings, no crew page. That is enforced on the server, not by hiding links.
        </p>
      </div>

      <section className="card flex flex-col" aria-labelledby="add-h">
        <div className="card-head">
          <span id="add-h" className="card-title">
            ADD SOMEONE
          </span>
          <span className="lbl">no password is set or shown</span>
        </div>
        <div className="p-4">
          <AddUserForm />
        </div>
      </section>

      <section className="card flex flex-col" aria-labelledby="list-h">
        <div className="card-head">
          <span id="list-h" className="card-title">
            CREW
          </span>
          <span className="lbl">
            {users.length} {users.length === 1 ? 'account' : 'accounts'} · {admins} admin{admins === 1 ? '' : 's'}
          </span>
        </div>
        {users.length === 0 ? (
          <p className="row-body">
            Nobody in the table yet. You are signed in through the ADMIN_EMAILS fallback, which stops counting the moment an admin exists
            here, so add yourself first.
          </p>
        ) : null}
        {users.map((u) => (
          <UserRow key={u.email} user={{ email: u.email, role: u.role, addedAt: u.addedAt, addedBy: u.addedBy }} self={u.email === email} lastAdmin={u.role === 'admin' && admins <= 1} />
        ))}
      </section>

      <section className="card flex flex-col" aria-labelledby="audit-h">
        <div className="card-head">
          <span id="audit-h" className="card-title">
            CHANGES
          </span>
          <span className="lbl">who did what, newest first</span>
        </div>
        {audit.length === 0 ? <p className="row-body">Nothing recorded yet.</p> : null}
        {audit.map((a) => (
          <div key={a.SK} className="row row-top">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="copy">
                <span className="num text-ink">{a.action}</span> {a.target}
                {a.role ? ` as ${a.role}` : ''}
                {a.detail ? `, ${a.detail}` : ''}
              </span>
              <span className="hint">by {a.by}</span>
            </span>
            <span className="num flex-none text-[11px] text-muted">{new Date(a.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
