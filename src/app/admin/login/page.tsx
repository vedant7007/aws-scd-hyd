import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm, VolunteerForm } from '@/components/admin/LoginForm'
import { currentCrew } from '@/lib/auth/admin'

export const metadata: Metadata = {
  title: 'Crew sign in',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage({ searchParams }: PageProps<'/admin/login'>) {
  const volunteer = (await searchParams).as === 'volunteer'
  const session = await currentCrew()
  if (session.status === 'ok') redirect(session.role === 'admin' ? '/admin' : '/admin/scan')

  return (
    <div className="page rise">
      <div className="flex flex-col gap-2.5">
        <span className="eye eye-violet">{'// ORGANISERS ONLY'}</span>
        <h1 className="h1">CREW SIGN IN</h1>
        <p className="lede">Attendees never see this page. Admins sign in with their password; volunteers just need their email.</p>
      </div>

      <nav aria-label="Sign in as" className="grid grid-cols-2 gap-2">
        <Link href="/admin/login" className={volunteer ? 'btn' : 'btn btn-primary'} aria-current={volunteer ? undefined : 'page'}>
          ADMIN
        </Link>
        <Link href="/admin/login?as=volunteer" className={volunteer ? 'btn btn-primary' : 'btn'} aria-current={volunteer ? 'page' : undefined}>
          VOLUNTEER
        </Link>
      </nav>

      {session.status === 'refused' ? (
        <p role="alert" className="notice-err">
          {session.email} is signed in but is not on the crew list.
        </p>
      ) : null}

      {volunteer ? (
        <div className="card flex flex-col gap-4 p-4">
          <VolunteerForm />
          <p className="hint">Not working? Ask an admin to add your email as a volunteer on the crew page first.</p>
        </div>
      ) : (
      <div className="card flex flex-col gap-4 p-4">
        <LoginForm />
        <p className="hint">
          Forgot it, or never set one? <Link href="/admin/login/reset">Set a new password</Link>. Accounts are created by an admin; there is no
          sign up.
        </p>
      </div>
      )}
    </div>
  )
}
