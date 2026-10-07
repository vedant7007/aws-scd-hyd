'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BUILDER_SIGNUP, BUILDER_STEPS, builderProfile } from '@/content/builder'

/** Pass ID and @username in, saved on the registration. */
export function BuilderIdForm({ initialPass }: { initialPass: string }) {
  const [pass, setPass] = useState(initialPass)
  const [builder, setBuilder] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/registrations/builder-id', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passId: pass, builderId: builder }),
      })
      const b = (await res.json().catch(() => ({}))) as { ok?: boolean; builderId?: string; field?: string; message?: string }
      if (res.ok && b.ok && b.builderId) setSaved(b.builderId)
      else setErr({ field: b.field, message: b.message ?? 'That did not save. Try again.' })
    } catch {
      setErr({ message: 'Could not reach the server. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    return (
      <div role="status" className="card card-mint flex flex-col gap-3 p-5">
        <span className="h3">SAVED, THANK YOU</span>
        <p className="copy">
          Your AWS Builder ID{' '}
          <a href={builderProfile(saved)} target="_blank" rel="noopener">
            @{saved}
          </a>{' '}
          is on your registration. Nothing else to do.
        </p>
        <Link href="/attending" className="btn btn-primary self-start">
          {"MAKE YOUR \"I'M ATTENDING\" POST >"}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="card flex flex-col gap-4 p-5">
      <div className="fld">
        <label htmlFor="bid-pass">Your pass ID</label>
        <input id="bid-pass" className="inp inp-num" value={pass} onChange={(e) => setPass(e.currentTarget.value.toUpperCase())} placeholder="SCD-XXXXXXXXXX" autoCapitalize="characters" autoComplete="off" aria-invalid={err?.field === 'pass'} />
        <span className="hint">It is in your registration email.</span>
      </div>
      <div className="fld">
        <label htmlFor="bid-builder">AWS Builder ID · your @username</label>
        <input id="bid-builder" className="inp" value={builder} onChange={(e) => setBuilder(e.currentTarget.value)} placeholder="@yourname" autoComplete="off" autoCapitalize="none" aria-invalid={err?.field === 'builder'} />
        <span className="hint">
          Sign in at builder.aws.com, click your name at the top right, then Manage profile. Your @username is there.
        </span>
      </div>
      {err ? (
        <p role="alert" className="err-text">
          {err.message}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary self-start" disabled={busy}>
        {busy ? 'SAVING' : 'SAVE MY BUILDER ID'}
      </button>

      <div className="card-dash flex flex-col gap-3 p-4">
        <span className="h3">NO BUILDER ID YET?</span>
        <a href={BUILDER_SIGNUP} target="_blank" rel="noopener" className="btn btn-mint self-start">
          {'CREATE ONE FREE >'}
        </a>
        <ol className="copy m-0 flex list-decimal flex-col gap-1.5 pl-5">
          {BUILDER_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <span className="hint">It is free and takes about two minutes. Then come back here and save the @username.</span>
      </div>
    </form>
  )
}
