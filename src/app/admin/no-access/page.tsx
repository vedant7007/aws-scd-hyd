import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/app/admin/login/actions'
import { currentCrew } from '@/lib/auth/admin'

export const metadata: Metadata = {
  title: 'Not a crew account',
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
  const session = await currentCrew()
  if (session.status === 'signed-out') redirect('/admin/login')
  if (session.status === 'ok') redirect(session.role === 'admin' ? '/admin' : '/admin/scan')

  return (
    <div className="page rise">
      <div className="flex flex-col gap-2.5">
        <span className="eye eye-amber">{'// NO ACCESS'}</span>
        <h1 className="h1">NOT A CREW ACCOUNT</h1>
        <p className="lede">You are signed in as {session.email}, but that address is on no crew list, so nothing here opens.</p>
        <p className="copy">
          If that is wrong, ask an admin to add you on the crew page. It takes effect within a few seconds, or straight away if you sign out
          and back in.
        </p>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="btn">
          SIGN OUT
        </button>
      </form>
    </div>
  )
}
