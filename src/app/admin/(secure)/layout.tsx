import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { signOutAction } from '@/app/admin/login/actions'
import { currentCrew } from '@/lib/auth/admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/** Every crew view reads live counts. Nothing here may be cached. */
export const dynamic = 'force-dynamic'

/**
 * SPEC.md section 7. Two gates: a valid Cognito session, then a role in the
 * table. A signed in user with no role gets told exactly that, never a blank
 * page and never a silent redirect loop. The role decides which links are
 * drawn; the pages and actions behind them check it again, so the links are
 * a convenience and not the guard.
 */
export default async function SecureAdminLayout({ children }: { children: ReactNode }) {
  const session = await currentCrew()

  if (session.status === 'signed-out') redirect('/admin/login')

  if (session.status === 'refused') redirect('/admin/no-access')

  const admin = session.role === 'admin'

  return (
    <>
      <div className="crew-bar">
        <div className="crew-bar-in">
          <span className={admin ? 'pill pill-orange pill-sm' : 'pill pill-violet pill-sm'}>{admin ? 'Admin · full access' : 'Volunteer · gate access'}</span>
          <span className="num truncate text-[11px] text-muted">{session.email}</span>
          <nav aria-label="Crew" className="crew-nav">
            {admin ? <Link href="/admin">DASHBOARD</Link> : null}
            <Link href="/admin/scan">SCAN</Link>
            {admin ? <Link href="/admin/users">CREW</Link> : null}
            {admin ? <Link href="/admin/settings">SETTINGS</Link> : null}
            <form action={signOutAction}>
              <button type="submit" className="btn btn-mono-sm">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </div>
      {children}
    </>
  )
}
