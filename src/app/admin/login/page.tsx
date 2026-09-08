import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/LoginForm'
import { Container } from '@/components/layout/Container'
import { currentAdmin } from '@/lib/auth/admin'

export const metadata: Metadata = {
  title: 'Organiser sign in',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const session = await currentAdmin()
  if (session.status === 'ok') redirect('/admin')

  return (
    <Container className="measure flex flex-col gap-8 py-24">
      <div>
        <p className="text-step--1 text-muted">Organisers only</p>
        <h1 className="display text-step-3">Sign in</h1>
      </div>

      {session.status === 'refused' ? (
        <p role="alert" className="text-step--1 text-accent">
          {session.email} is signed in but is not on the organiser list.
        </p>
      ) : null}

      <LoginForm />

      <p className="text-step--1 text-muted">
        Accounts are created by an admin. There is no sign up, and attendees never sign in anywhere.
      </p>
    </Container>
  )
}
