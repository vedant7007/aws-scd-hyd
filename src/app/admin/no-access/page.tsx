import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/app/admin/login/actions'
import { Container } from '@/components/layout/Container'
import { currentAdmin } from '@/lib/auth/admin'

export const metadata: Metadata = {
  title: 'Not an organiser account',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * The explicit refusal from SPEC.md section 7. It lives on its own route rather
 * than inside the admin layout, because a layout that merely declines to render
 * its children does not stop Next rendering them, and the dashboard payload
 * would still be in the response.
 */
export default async function NoAccessPage() {
  const session = await currentAdmin()
  if (session.status === 'signed-out') redirect('/admin/login')
  if (session.status === 'ok') redirect('/admin')

  return (
    <Container className="measure flex flex-col gap-6 py-24">
      <h1 className="display text-step-3">Not an organiser account</h1>
      <p className="text-step-1 text-muted">
        You are signed in as {session.email}, but that address is not on the organiser list, so the
        dashboard stays closed.
      </p>
      <p className="text-muted">
        If that is wrong, ask Vedant to add it to ADMIN_EMAILS. Nothing here is cached, so it will work the
        moment the list changes.
      </p>
      <form action={signOutAction}>
        <button type="submit" className="cta-quiet">
          Sign out
        </button>
      </form>
    </Container>
  )
}
