'use client'

import Image from 'next/image'
import { useId, useRef, useState, type FormEvent } from 'react'

type Props = {
  passId: string
  amountLabel: string
  qr: string
  upiId: string | null
  payee: string
  verificationWindow: string
  /** Set when the student is back after a rejection. */
  rejectedReason: string | null
  previousUtr: string | null
  contactEmail: string
}

type Phase = { kind: 'form' } | { kind: 'uploading' } | { kind: 'submitting' } | { kind: 'done' }

/**
 * Amendment 1 section 2. The student pays in their own UPI app, quoting the
 * pass id in the note, then comes back here with the UTR and a screenshot.
 * The screenshot goes straight to the private bucket on a one-shot URL; the
 * UTR goes to the server, which moves the record to PENDING_VERIFICATION.
 */
export function PayStep({ passId, amountLabel, qr, upiId, payee, verificationWindow, rejectedReason, previousUtr, contactEmail }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const ids = useId()
  const busy = phase.kind === 'uploading' || phase.kind === 'submitting'

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Older browsers. The value is on screen to type.
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const utr = String(new FormData(e.currentTarget).get('utr') ?? '').replace(/\s+/g, '')
    const file = fileRef.current?.files?.[0]
    if (!/^\d{12}$/.test(utr)) return setError({ field: 'utr', message: 'A UTR is exactly 12 digits. It is in your UPI app under the payment.' })
    if (!file) return setError({ field: 'screenshot', message: 'Add the payment screenshot from your UPI app.' })

    setPhase({ kind: 'uploading' })
    let key: string
    try {
      const grant = await fetch('/api/register/screenshot', {
        method: 'post',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passId, contentType: file.type, bytes: file.size }),
      })
      const g = (await grant.json()) as { ok: boolean; url?: string; key?: string; headers?: Record<string, string>; message?: string }
      if (!g.ok || !g.url || !g.key) throw new Error(g.message ?? 'Could not start the upload.')
      const put = await fetch(g.url, { method: 'PUT', headers: g.headers, body: file })
      if (!put.ok) throw new Error('The screenshot did not upload. Check your connection and try again.')
      key = g.key
    } catch (err) {
      setError({ field: 'screenshot', message: err instanceof Error ? err.message : 'The screenshot did not upload.' })
      setPhase({ kind: 'form' })
      return
    }

    setPhase({ kind: 'submitting' })
    try {
      const res = await fetch('/api/register/utr', {
        method: 'post',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passId, utr, screenshotKey: key }),
      })
      const data = (await res.json()) as { ok: boolean; field?: string; message?: string }
      if (!data.ok) {
        setError({ field: data.field, message: data.message ?? 'That did not go through.' })
        setPhase({ kind: 'form' })
        return
      }
      setPhase({ kind: 'done' })
    } catch {
      setError({ message: 'Could not reach the server. Your screenshot is uploaded; try submitting the UTR again.' })
      setPhase({ kind: 'form' })
    }
  }

  if (phase.kind === 'done') return <Received passId={passId} verificationWindow={verificationWindow} contactEmail={contactEmail} />

  const fieldError = (f: string) => (error?.field === f ? error.message : null)

  return (
    <div className="reg-grid">
      <section className="reg-form" aria-labelledby="pay-heading">
        {rejectedReason !== null ? (
          <div role="alert" className="notice">
            <p className="font-semibold">We could not match your last payment{previousUtr ? ` (UTR ${previousUtr})` : ''}.</p>
            <p className="text-step--1 text-muted">{rejectedReason || 'Check the UTR in your UPI app and submit the correct one below.'}</p>
          </div>
        ) : null}

        <div className="reg-block">
          <p className="eyebrow">Step 1 of 2</p>
          <h2 id="pay-heading" className="display text-step-2 mt-2">
            Pay {amountLabel} by UPI
          </h2>
          <ol className="mt-4 flex flex-col gap-2 text-step--1 text-muted">
            <li>1. Scan the QR with any UPI app, or pay the UPI ID below.</li>
            <li>
              2. Put your pass ID in the note: <span className="numeral text-text">{passId}</span>
            </li>
            <li>3. Pay exactly {amountLabel}. The payee shows as {payee}.</li>
            <li>4. Keep the screenshot and note the 12 digit UTR.</li>
          </ol>
          <div className="qr-plate mt-6" style={{ maxWidth: '18rem' }}>
            <Image src={qr} alt={`UPI QR code for ${payee}`} width={512} height={512} sizes="18rem" style={{ width: '100%', height: 'auto' }} priority />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="cta-quiet" onClick={() => copy('pass id', passId)}>
              {copied === 'pass id' ? 'Copied' : 'Copy pass ID for the note'}
            </button>
            {upiId ? (
              <button type="button" className="cta-quiet" onClick={() => copy('upi', upiId)}>
                {copied === 'upi' ? 'Copied' : `Copy UPI ID ${upiId}`}
              </button>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="reg-block">
          <p className="eyebrow">Step 2 of 2</p>
          <h2 className="display text-step-2 mt-2">Tell us it went through</h2>
          <fieldset disabled={busy} className="mt-4 flex flex-col gap-6">
            <div className="reg-field">
              <label htmlFor={`${ids}-utr`}>UTR, 12 digits</label>
              <input
                id={`${ids}-utr`}
                name="utr"
                className="field numeral"
                inputMode="numeric"
                autoComplete="off"
                pattern="\d{12}"
                maxLength={14}
                required
                defaultValue={previousUtr ?? ''}
                aria-invalid={fieldError('utr') ? true : undefined}
                aria-describedby={`${ids}-utr-hint${fieldError('utr') ? ` ${ids}-utr-err` : ''}`}
              />
              <p id={`${ids}-utr-hint`} className="reg-hint">
                In your UPI app, open the payment and look for UTR or UPI Ref. No spaces.
              </p>
              {fieldError('utr') ? <p id={`${ids}-utr-err`} className="reg-error">{fieldError('utr')}</p> : null}
            </div>
            <div className="reg-field">
              <label htmlFor={`${ids}-shot`}>Payment screenshot</label>
              <input
                id={`${ids}-shot`}
                ref={fileRef}
                name="screenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="field"
                required
                aria-invalid={fieldError('screenshot') ? true : undefined}
                aria-describedby={`${ids}-shot-hint${fieldError('screenshot') ? ` ${ids}-shot-err` : ''}`}
              />
              <p id={`${ids}-shot-hint`} className="reg-hint">
                The success screen from your UPI app, under 8 MB. Only the organisers can see it, and it is deleted after the event.
              </p>
              {fieldError('screenshot') ? <p id={`${ids}-shot-err`} className="reg-error">{fieldError('screenshot')}</p> : null}
            </div>
            {error && !error.field ? (
              <p role="alert" className="reg-error">
                {error.message}
              </p>
            ) : null}
            <div className="reg-actions">
              <button type="submit" className="cta" disabled={busy}>
                {phase.kind === 'uploading' ? 'Uploading screenshot' : phase.kind === 'submitting' ? 'Sending' : 'Submit UTR'}
              </button>
              <p className="text-step--1 text-muted">We check every payment against the bank statement. Expect an email within {verificationWindow}.</p>
            </div>
          </fieldset>
        </form>
      </section>

      <aside className="reg-aside" aria-label="Your registration">
        <div className="reg-summary">
          <p className="eyebrow">Your pass ID</p>
          <p className="display text-step-2 mt-2 numeral">{passId}</p>
          <p className="text-step--1 text-muted mt-2">Keep it. It is how we find your registration, and it opens your pass once the payment is checked.</p>
          <div className="reg-total">
            <span>To pay</span>
            <span className="numeral">{amountLabel}</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

export function Received({ passId, verificationWindow, contactEmail }: { passId: string; verificationWindow: string; contactEmail: string }) {
  return (
    <div className="reg-result enter" role="status">
      <p className="eyebrow">Received</p>
      <p className="awaiting-head mt-2">
        We have <em>your UTR</em>
      </p>
      <p className="measure text-muted">
        We are checking the payment against our bank records. You will get an email within {verificationWindow}. Until then there is nothing
        you need to do. If it has not arrived by then, write to {contactEmail} and quote your pass ID.
      </p>
      <p className="text-step--1 text-muted">
        Pass ID <span className="numeral">{passId}</span>
      </p>
    </div>
  )
}
