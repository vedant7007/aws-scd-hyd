import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { signOutAction } from '@/app/admin/login/actions'
import { Container } from '@/components/layout/Container'
import { currentAdmin } from '@/lib/auth/admin'

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/** Every admin view reads live counts. Nothing here may be cached. */
export const dynamic = 'force-dynamic'

/**
 * SPEC.md section 7. Two gates: a valid Cognito session, then the email on the
 * ADMIN_EMAILS allowlist. A signed in user who is not an organiser gets told
 * exactly that, never a blank page and never a silent redirect loop.
 */
export default async function SecureAdminLayout({ children }: { children: ReactNode }) {
  const session = await currentAdmin()

  if (session.status === 'signed-out') redirect('/admin/login')

  if (session.status === 'refused') redirect('/admin/no-access')

  return (
    <>
      <Container className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border py-4">
        <nav aria-label="Organiser" className="flex flex-wrap gap-x-8 gap-y-2">
          <Link className="link" href="/admin">
            Dashboard
          </Link>
          <Link className="link" href="/admin/scan">
            Scan
          </Link>
        </nav>
        <div className="flex items-baseline gap-4">
          <span className="text-step--1 text-muted">{session.email}</span>
          <form action={signOutAction}>
            <button type="submit" className="link">
              Sign out
            </button>
          </form>
        </div>
      </Container>
      {children}
    </>
  )
}
