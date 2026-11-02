'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Proof in, certificate out. The screenshot goes straight to the private
 * bucket on a one-shot URL, then the claim is checked on the server. Issued
 * means straight to the certificate page; held means an organiser looks first.
 */

type Field = 'passId' | 'certName' | 'surveyId'
const ERR = 'min-h-px text-[12.5px] text-[var(--err-ink)]'

export function ClaimForm({ initialPass, survey }: { initialPass: string; survey: string }) {
  const router = useRouter()
  const [form, setForm] = useState<Record<Field, string>>({ passId: initialPass, certName: '', surveyId: '' })
  const [shot, setShot] = useState<File | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [held, setHeld] = useState(false)

  const on = (k: Field) => (e: { currentTarget: HTMLInputElement }) => {
    const v = k === 'passId' ? e.currentTarget.value.toUpperCase() : e.currentTarget.value
    setForm((p) => ({ ...p, [k]: v }))
    setErr((x) => Object.fromEntries(Object.entries(x).filter(([y]) => y !== k && y !== 'form')))
  }

  const fail = (field: string, message: string) => {
    setErr({ [field]: message })
    document.getElementById(`cf-${field}`)?.focus()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!shot) return fail('shot', 'Add the screenshot of your survey submission.')
    try {
      setBusy('UPLOADING SCREENSHOT…')
      const up = await fetch('/api/certificate/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passId: form.passId, contentType: shot.type, bytes: shot.size }),
      })
      const grant = (await up.json().catch(() => ({}))) as { ok?: boolean; url?: string; key?: string; headers?: Record<string, string>; field?: string; message?: string }
      if (!up.ok || !grant.ok || !grant.url) return fail(grant.field ?? 'form', grant.message ?? 'The upload did not start. Try again.')
      const put = await fetch(grant.url, { method: 'PUT', headers: grant.headers, body: shot })
      if (!put.ok) return fail('shot', 'The screenshot did not upload. Check your connection and try again.')

      setBusy('MAKING YOUR CERTIFICATE…')
      const res = await fetch('/api/certificate/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, screenshotKey: grant.key }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; state?: string; certId?: string; field?: string; message?: string }
      if (!res.ok || !body.ok) return fail(body.field ?? 'form', body.message ?? 'Something went wrong on our side. Try again in a minute.')
      if (body.state === 'ISSUED' && body.certId) return router.push(`/certificate/${body.certId}?new=1`)
      setHeld(true)
      window.scrollTo({ top: 0 })
    } catch {
      fail('form', 'Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy('')
    }
  }

  if (held) {
    return (
      <div className="card-gold flex flex-col gap-3 p-5" role="status">
        <span className="eye">{'// ALMOST THERE'}</span>
        <h2 className="h2">WE ARE TAKING A QUICK LOOK</h2>
        <p className="lede">
          That survey submission ID was already used with another pass, so an organiser will check the screenshots by hand. Nothing more for you to do: you get an email with your certificate as soon as it is cleared.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <section className="card flex flex-col gap-3 p-5">
        <span className="lbl">STEP 1</span>
        <h2 className="h2">FILL THE AWS SURVEY</h2>
        <p className="lede">Answer the AWS event survey. When you submit, open its <strong>My Submissions</strong> tab: you will see your answers and an ID that starts with SurveySubmission-.</p>
        <a href={survey} target="_blank" rel="noopener noreferrer" className="btn btn-primary self-start">
          OPEN THE SURVEY &gt;
        </a>
        <p className="hint">The survey asks: group <strong>AWS Student Builders Group, VJIT</strong>, event <strong>AWS Student Community Day Hyderabad 2026</strong>, date <strong>30/10/2026</strong>.</p>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <span className="lbl">STEP 2</span>
        <h2 className="h2">SHOW US YOU DID IT</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="cf-passId" className="lbl">
              Pass ID <span className="text-[var(--err-ink)]">*</span>
            </label>
            <input id="cf-passId" className="inp num uppercase" value={form.passId} onChange={on('passId')} placeholder="SCD-XXXXXXXXXX" autoComplete="off" spellCheck={false} aria-invalid={Boolean(err.passId)} />
            <span className={ERR}>{err.passId}</span>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="cf-certName" className="lbl">
              Name on certificate <span className="text-[var(--err-ink)]">*</span>
            </label>
            <input id="cf-certName" className="inp" value={form.certName} onChange={on('certName')} placeholder="Exactly as you want it printed" autoComplete="name" maxLength={60} aria-invalid={Boolean(err.certName)} />
            <span className={ERR}>{err.certName}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="cf-surveyId" className="lbl">
            Survey submission ID <span className="text-[var(--err-ink)]">*</span>
          </label>
          <input id="cf-surveyId" className="inp num" value={form.surveyId} onChange={on('surveyId')} placeholder="SurveySubmission-…" autoComplete="off" spellCheck={false} aria-invalid={Boolean(err.surveyId)} />
          <span className={ERR}>{err.surveyId || 'Top right of your answers on the My Submissions tab. Tap the copy icon next to it.'}</span>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="cf-shot" className="lbl">
            Screenshot of your submission <span className="text-[var(--err-ink)]">*</span>
          </label>
          <input
            id="cf-shot"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="inp"
            onChange={(e) => (setShot(e.currentTarget.files?.[0] ?? null), setErr({}))}
            aria-invalid={Boolean(err.shot)}
          />
          <span className={ERR}>{err.shot || 'The My Submissions page with the ID showing. JPG or PNG, under 5 MB.'}</span>
        </div>
      </section>

      {err.form ? (
        <p role="alert" className="card-err p-3 text-[14px]">
          {err.form}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-lg" disabled={Boolean(busy)}>
        {busy || 'GET MY CERTIFICATE >'}
      </button>
    </form>
  )
}
