import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetForm } from '@/components/admin/LoginForm'

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
}

/**
 * The only way a password is ever set on this site. A new crew account has
 * one nobody knows until its owner comes here; the code goes to the
 * account's email and the new password goes straight to Cognito.
 */
export default function ResetPage() {
  return (
    <div className="page rise">
      <div className="flex flex-col gap-2.5">
        <span className="eye eye-violet">{'// CREW'}</span>
        <h1 className="h1">SET A NEW PASSWORD</h1>
        <p className="lede">Enter your crew email and we send a code to it. Then enter the code with the password you want.</p>
      </div>
      <div className="card flex flex-col gap-4 p-4">
        <ResetForm />
      </div>
      <Link href="/admin/login" className="btn self-start">
        &lt; BACK TO SIGN IN
      </Link>
    </div>
  )
}
