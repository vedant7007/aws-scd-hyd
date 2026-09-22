import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/LoginForm'
import { currentCrew } from '@/lib/auth/admin'

export const metadata: Metadata = {
  title: 'Crew sign in',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const session = await currentCrew()
  if (session.status === 'ok') redirect(session.role === 'admin' ? '/admin' : '/admin/scan')

  return (
    <div className="page rise">
      <div className="flex flex-col gap-2.5">
        <span className="eye eye-violet">{'// ORGANISERS ONLY'}</span>
        <h1 className="h1">CREW SIGN IN</h1>
        <p className="lede">Attendees never see this page. Sign in with the account you were given. It is a Cognito login, not your college email.</p>
      </div>

      {session.status === 'refused' ? (
        <p role="alert" className="notice-err">
          {session.email} is signed in but is not on the crew list.
        </p>
      ) : null}

      <div className="card flex flex-col gap-4 p-4">
        <LoginForm />
        <p className="hint">
          Forgot it, or never set one? <Link href="/admin/login/reset">Set a new password</Link>. Accounts are created by an admin; there is no
          sign up.
        </p>
      </div>
    </div>
  )
}
