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
    <div className="flex flex-col gap-[clamp(22px,5vh,36px)]">
      {rejectedReason !== null ? (
        <div role="alert" className="notice-err">
          <span className="notice-title">WE COULD NOT MATCH YOUR LAST PAYMENT</span>
          <p className="copy">
            {previousUtr ? `UTR ${previousUtr}. ` : ''}
            {rejectedReason || 'Check the UTR in your UPI app and submit the correct one below.'}
          </p>
        </div>
      ) : null}

      <div className="steps" aria-hidden="true">
        <span data-state="now" />
        <span />
      </div>

      <section aria-labelledby="pay-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eye">STEP 01 OF 02</span>
          <span className="lbl">Pay by UPI</span>
        </div>
        <h2 id="pay-heading" className="h1">
          PAY <span className="num">{amountLabel}</span>
        </h2>
        <div className="card flex flex-col gap-4 p-4">
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            <li className="flex gap-3">
              <span className="num flex-none font-semibold text-amber-ink">01</span>
              <span className="copy">Scan the QR with any UPI app{upiId ? ', or pay the UPI ID below' : ''}.</span>
            </li>
            <li className="flex gap-3">
              <span className="num flex-none font-semibold text-amber-ink">02</span>
              <span className="copy">
                Put your pass ID in the note: <span className="num text-ink">{passId}</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="num flex-none font-semibold text-amber-ink">03</span>
              <span className="copy">
                Pay exactly <span className="num text-ink">{amountLabel}</span>. The payee shows as {payee}.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="num flex-none font-semibold text-amber-ink">04</span>
              <span className="copy">Keep the screenshot and note the 12 digit UTR.</span>
            </li>
          </ol>
          <div className="qr-plate qr-plate-lg self-center">
            <Image src={qr} alt={`UPI QR code for ${payee}`} width={512} height={512} sizes="18rem" priority />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className="btn btn-sm" onClick={() => copy('pass id', passId)}>
              {copied === 'pass id' ? 'COPIED' : 'COPY PASS ID FOR THE NOTE'}
            </button>
            {upiId ? (
              <button type="button" className="btn btn-sm" onClick={() => copy('upi', upiId)}>
                {copied === 'upi' ? 'COPIED' : `COPY UPI ID ${upiId}`}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-labelledby="utr-heading">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eye">STEP 02 OF 02</span>
          <span className="lbl">Then tell us</span>
        </div>
        <h2 id="utr-heading" className="h1">
          TELL US IT WENT THROUGH
        </h2>
        <fieldset disabled={busy} className="card m-0 flex flex-col gap-4 p-4">
          <div className="fld">
            <label htmlFor={`${ids}-utr`}>
              UTR, 12 digits <span className="req">*</span>
            </label>
            <input
              id={`${ids}-utr`}
              name="utr"
              className="inp inp-num"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d{12}"
              maxLength={14}
              required
              defaultValue={previousUtr ?? ''}
              aria-invalid={fieldError('utr') ? true : undefined}
              aria-describedby={`${ids}-utr-hint${fieldError('utr') ? ` ${ids}-utr-err` : ''}`}
            />
            <p id={`${ids}-utr-hint`} className="hint">
              In your UPI app, open the payment and look for UTR or UPI Ref. No spaces.
            </p>
            {fieldError('utr') ? (
              <p id={`${ids}-utr-err`} className="err-text">
                {fieldError('utr')}
              </p>
            ) : null}
          </div>
          <div className="fld">
            <label htmlFor={`${ids}-shot`}>
              Payment screenshot <span className="req">*</span>
            </label>
            <input
              id={`${ids}-shot`}
              ref={fileRef}
              name="screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="inp"
              required
              aria-invalid={fieldError('screenshot') ? true : undefined}
              aria-describedby={`${ids}-shot-hint${fieldError('screenshot') ? ` ${ids}-shot-err` : ''}`}
            />
            <p id={`${ids}-shot-hint`} className="hint">
              The success screen from your UPI app, under 8 MB. Only the organisers can see it, and it is deleted after the event.
            </p>
            {fieldError('screenshot') ? (
              <p id={`${ids}-shot-err`} className="err-text">
                {fieldError('screenshot')}
              </p>
            ) : null}
          </div>
          {error && !error.field ? (
            <p role="alert" className="err-text">
              {error.message}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {phase.kind === 'uploading' ? 'UPLOADING SCREENSHOT' : phase.kind === 'submitting' ? 'SENDING' : 'SUBMIT UTR >'}
          </button>
          <p className="hint">We check every payment against the bank statement. Expect an email within {verificationWindow}.</p>
        </fieldset>
      </form>
    </div>
  )
}

export function Received({ passId, verificationWindow, contactEmail }: { passId: string; verificationWindow: string; contactEmail: string }) {
  return (
    <div className="flex flex-col items-start gap-4" role="status">
      <span className="pill">Received</span>
      <h1 className="h1">WE HAVE YOUR UTR</h1>
      <p className="lede">
        We are checking the payment against our bank records. You will get an email within {verificationWindow}. Until then there is nothing
        you need to do. If it has not arrived by then, write to {contactEmail} and quote your pass ID.
      </p>
      <PassIdNote passId={passId} />
    </div>
  )
}

/** The id the student will need to quote, in the handoff's mint panel. */
export function PassIdNote({ passId, label = 'Your pass ID' }: { passId: string; label?: string }) {
  return (
    <div className="notice-mint w-full">
      <span className="lbl text-mint-ink">{label}</span>
      <span className="num-lg">{passId}</span>
    </div>
  )
}
