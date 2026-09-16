'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { FoodPreference, Tier } from '@/lib/db/types'

export type TierOption = {
  id: Tier
  name: string
  priceLabel: string
  /** True while content/passes.ts has no price and the test amount is in force. */
  placeholder: boolean
  includes: string[]
  recommended: boolean
}

const FOODS: { id: FoodPreference; label: string }[] = [
  { id: 'veg', label: 'Veg' },
  { id: 'nonveg', label: 'Non-veg' },
  { id: 'jain', label: 'Jain' },
]

/** What /api/checkout hands back. The amount is display only here. */
type Checkout = {
  ticketRef: string
  checkoutToken: string
  orderId: string
  amountPaise: number
  currency: string
  keyId: string
  placeholder: boolean
  prefill: { name: string; email: string; contact: string }
}

type Phase =
  | { kind: 'form' }
  | { kind: 'creating' }
  | { kind: 'paying'; checkout: Checkout }
  | { kind: 'dismissed'; checkout: Checkout }
  | { kind: 'failed'; checkout: Checkout; reason: string }
  | { kind: 'confirming'; checkout: Checkout; slow: boolean }
  | { kind: 'paid'; checkout: Checkout; passUrl: string; email: string }

/** Minimal surface of checkout.js. Typed by hand, the script defines a global. */
type RazorpayInstance = {
  open(): void
  on(event: 'payment.failed', handler: (r: { error?: { description?: string; reason?: string } }) => void): void
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayCtor
  }
}

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js'
let checkoutJs: Promise<RazorpayCtor> | null = null

/** Loaded once, on first use, never on page load: most visitors never pay. */
function loadCheckout(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  checkoutJs ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = CHECKOUT_JS
    s.async = true
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('checkout.js loaded without Razorpay')))
    s.onerror = () => {
      checkoutJs = null
      reject(new Error('Could not load the payment window.'))
    }
    document.head.appendChild(s)
  })
  return checkoutJs
}

const POLL_MS = 2000
const SLOW_AFTER_MS = 90_000

export function RegisterForm({
  tiers,
  preselect,
  eventName,
  contactEmail,
}: {
  tiers: TierOption[]
  preselect?: Tier
  eventName: string
  contactEmail: string
}) {
  const [tier, setTier] = useState<Tier | ''>(preselect ?? tiers.find((t) => t.recommended)?.id ?? tiers[0]?.id ?? '')
  const [food, setFood] = useState<FoodPreference | ''>('')
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  // A limit was hit. Not an error in what they typed, so it is told, not flagged.
  const [notice, setNotice] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const ids = useId()

  const chosen = tiers.find((t) => t.id === tier)
  const busy = phase.kind === 'creating' || phase.kind === 'paying'

  // Confirming: ask the server every two seconds whether the webhook landed.
  // This never decides anything, it only reads what the webhook wrote.
  useEffect(() => {
    if (phase.kind !== 'confirming') return
    const { checkout } = phase
    const startedAt = Date.now()
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch('/api/checkout/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ticketRef: checkout.ticketRef, checkoutToken: checkout.checkoutToken }),
        })
        const data = (await res.json()) as { status?: string; passUrl?: string | null; email?: string }
        if (cancelled) return
        if (data.status === 'paid' && data.passUrl) {
          setPhase({ kind: 'paid', checkout, passUrl: data.passUrl, email: data.email ?? checkout.prefill.email })
          return
        }
      } catch {
        // A failed poll is just a missed tick.
      }
      if (cancelled) return
      if (!phase.slow && Date.now() - startedAt > SLOW_AFTER_MS) setPhase({ kind: 'confirming', checkout, slow: true })
      timer = window.setTimeout(tick, POLL_MS)
    }
    let timer = window.setTimeout(tick, POLL_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [phase])

  // Move focus to whatever just happened, so a screen reader hears it.
  useEffect(() => {
    if (phase.kind === 'confirming' || phase.kind === 'paid' || phase.kind === 'failed') resultRef.current?.focus()
  }, [phase.kind])

  async function openCheckout(checkout: Checkout) {
    setPhase({ kind: 'paying', checkout })
    let Razorpay: RazorpayCtor
    try {
      Razorpay = await loadCheckout()
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not load the payment window.' })
      setPhase({ kind: 'dismissed', checkout })
      return
    }

    // The modal takes a colour. It is read from the theme at open time so the
    // token stays the single place the accent lives.
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()

    const rzp = new Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      name: eventName,
      description: `${chosen?.name ?? 'Pass'} pass`,
      prefill: checkout.prefill,
      theme: { color: accent },
      // Success here is UX only. The server has not heard from Razorpay yet.
      handler: () => setPhase({ kind: 'confirming', checkout, slow: false }),
      modal: { ondismiss: () => setPhase((p) => (p.kind === 'paying' ? { kind: 'dismissed', checkout } : p)) },
    })
    rzp.on('payment.failed', (r) =>
      setPhase({ kind: 'failed', checkout, reason: r.error?.description ?? r.error?.reason ?? 'The payment did not go through.' }),
    )
    rzp.open()
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    // Same order, same record, when they only closed the window.
    if (phase.kind === 'dismissed' || phase.kind === 'failed') return openCheckout(phase.checkout)

    const fd = new FormData(e.currentTarget)
    const body = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      college: String(fd.get('college') ?? ''),
      tier,
      foodPreference: food,
    }

    setPhase({ kind: 'creating' })
    let res: Response
    try {
      res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      setError({ message: 'Could not reach the server. Check your connection and try again.' })
      setPhase({ kind: 'form' })
      return
    }

    const data = (await res.json().catch(() => ({}))) as Partial<Checkout> & { ok?: boolean; field?: string; message?: string }
    if (res.status === 429) {
      setNotice(data.message ?? 'Too many registrations right now. Nothing was charged. Try again in a while.')
      setPhase({ kind: 'form' })
      return
    }
    if (!res.ok || !data.ok || !data.orderId) {
      setError({ field: data.field, message: data.message ?? 'Something went wrong. Nothing was charged.' })
      setPhase({ kind: 'form' })
      return
    }

    await openCheckout(data as Checkout)
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : null)

  if (phase.kind === 'paid') {
    return (
      <div ref={resultRef} tabIndex={-1} className="reg-result enter" role="status">
        <p className="eyebrow">Paid</p>
        <p className="awaiting-head mt-2">
          You are <em>in</em>
        </p>
        <p className="measure text-muted">
          Your pass is ready and a copy is on its way to {phase.email}. Open it now to pick your sessions.
        </p>
        <p>
          <Link className="cta" href={phase.passUrl}>
            Open your pass
          </Link>
        </p>
        <p className="text-step--1 text-muted">
          Ticket <span className="numeral">{phase.checkout.ticketRef}</span>
        </p>
      </div>
    )
  }

  if (phase.kind === 'confirming') {
    return (
      <div ref={resultRef} tabIndex={-1} className="reg-result enter" role="status" aria-live="polite">
        <p className="eyebrow">One moment</p>
        <p className="awaiting-head mt-2">
          Confirming <em>your payment</em>
        </p>
        <p className="measure text-muted">
          {phase.slow
            ? `This is taking longer than usual. Your pass will be emailed to ${phase.checkout.prefill.email} as soon as the payment settles, usually within the hour. If it has not arrived by then, write to ${contactEmail} and quote ${phase.checkout.ticketRef}.`
            : 'Waiting for the payment provider to confirm. This usually takes a few seconds. Keep this page open.'}
        </p>
        <p className="text-step--1 text-muted">
          Ticket <span className="numeral">{phase.checkout.ticketRef}</span>
        </p>
      </div>
    )
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={onSubmit}
        // Editing anything after a closed or failed attempt means a new order,
        // so the record behind it matches what they typed, not what they typed before.
        onChange={() => {
          if (phase.kind === 'dismissed' || phase.kind === 'failed') setPhase({ kind: 'form' })
        }}
        className="reg-form"
        noValidate
      >
        <fieldset className="reg-block" disabled={busy}>
          <legend className="eyebrow">You</legend>

          <div className="reg-field">
            <label htmlFor={`${ids}-name`}>Name</label>
            <input
              id={`${ids}-name`}
              name="name"
              className="field"
              autoComplete="name"
              required
              maxLength={80}
              aria-invalid={fieldError('name') ? true : undefined}
              aria-describedby={fieldError('name') ? `${ids}-name-err` : undefined}
            />
            {fieldError('name') ? <p id={`${ids}-name-err`} className="reg-error">{fieldError('name')}</p> : null}
          </div>

          <div className="reg-two">
            <div className="reg-field">
              <label htmlFor={`${ids}-email`}>Email</label>
              <input
                id={`${ids}-email`}
                name="email"
                type="email"
                className="field"
                autoComplete="email"
                required
                maxLength={254}
                aria-invalid={fieldError('email') ? true : undefined}
                aria-describedby={`${ids}-email-hint${fieldError('email') ? ` ${ids}-email-err` : ''}`}
              />
              <p id={`${ids}-email-hint`} className="reg-hint">Your pass is sent here.</p>
              {fieldError('email') ? <p id={`${ids}-email-err`} className="reg-error">{fieldError('email')}</p> : null}
            </div>

            <div className="reg-field">
              <label htmlFor={`${ids}-phone`}>Mobile</label>
              <input
                id={`${ids}-phone`}
                name="phone"
                type="tel"
                className="field"
                autoComplete="tel"
                inputMode="numeric"
                required
                aria-invalid={fieldError('phone') ? true : undefined}
                aria-describedby={`${ids}-phone-hint${fieldError('phone') ? ` ${ids}-phone-err` : ''}`}
              />
              <p id={`${ids}-phone-hint`} className="reg-hint">Ten digits, India.</p>
              {fieldError('phone') ? <p id={`${ids}-phone-err`} className="reg-error">{fieldError('phone')}</p> : null}
            </div>
          </div>

          <div className="reg-field">
            <label htmlFor={`${ids}-college`}>College</label>
            <input
              id={`${ids}-college`}
              name="college"
              className="field"
              autoComplete="organization"
              required
              maxLength={120}
              aria-invalid={fieldError('college') ? true : undefined}
              aria-describedby={fieldError('college') ? `${ids}-college-err` : undefined}
            />
            {fieldError('college') ? <p id={`${ids}-college-err`} className="reg-error">{fieldError('college')}</p> : null}
          </div>
        </fieldset>

        <fieldset className="reg-block" disabled={busy}>
          <legend className="eyebrow">Pass</legend>
          <div className="choice-list" role="radiogroup" aria-describedby={fieldError('tier') ? `${ids}-tier-err` : undefined}>
            {tiers.map((t) => (
              <label key={t.id} className="choice" data-checked={tier === t.id ? 'true' : undefined}>
                <input
                  type="radio"
                  name="tier"
                  value={t.id}
                  checked={tier === t.id}
                  onChange={() => setTier(t.id)}
                  className="choice-input"
                />
                <span className="choice-body">
                  <span className="choice-head">
                    <span className="choice-name">{t.name}</span>
                    {t.recommended ? <span className="badge">Pick</span> : null}
                  </span>
                  <span className="choice-detail">{t.includes.join(', ')}</span>
                </span>
                <span className="choice-price">
                  <span className="numeral">{t.priceLabel}</span>
                  {t.placeholder ? <span className="choice-flag">Test price, placeholder</span> : null}
                </span>
              </label>
            ))}
          </div>
          {fieldError('tier') ? <p id={`${ids}-tier-err`} className="reg-error">{fieldError('tier')}</p> : null}
        </fieldset>

        <fieldset className="reg-block" disabled={busy}>
          <legend className="eyebrow">Lunch</legend>
          <div className="choice-row" role="radiogroup" aria-describedby={fieldError('foodPreference') ? `${ids}-food-err` : undefined}>
            {FOODS.map((f) => (
              <label key={f.id} className="chip" data-checked={food === f.id ? 'true' : undefined}>
                <input
                  type="radio"
                  name="foodPreference"
                  value={f.id}
                  checked={food === f.id}
                  onChange={() => setFood(f.id)}
                  className="choice-input"
                  required
                />
                {f.label}
              </label>
            ))}
          </div>
          {fieldError('foodPreference') ? (
            <p id={`${ids}-food-err`} className="reg-error">{fieldError('foodPreference')}</p>
          ) : null}
        </fieldset>

        {error && !error.field ? (
          <p role="alert" className="reg-error">
            {error.message}
          </p>
        ) : null}

        {notice ? (
          <div role="alert" className="notice">
            <p className="font-semibold">This registration was not started.</p>
            <p className="text-step--1 text-muted">{notice}</p>
          </div>
        ) : null}

        {phase.kind === 'failed' ? (
          <div ref={resultRef} tabIndex={-1} role="alert" className="notice">
            <p className="font-semibold">The payment did not go through.</p>
            <p className="text-step--1 text-muted">
              {phase.reason} Nothing was charged. You can try again with the same details.
            </p>
          </div>
        ) : null}

        <div className="reg-actions">
          <button type="submit" className="cta" disabled={busy || !tier || !food}>
            {phase.kind === 'creating'
              ? 'Preparing'
              : phase.kind === 'paying'
                ? 'Payment window open'
                : phase.kind === 'dismissed' || phase.kind === 'failed'
                  ? `Try again, ${chosen?.priceLabel ?? ''}`
                  : `Pay ${chosen?.priceLabel ?? ''}`}
          </button>
          <p className="text-step--1 text-muted">Secure payment by Razorpay. Cards, UPI and net banking.</p>
        </div>
      </form>

      <aside className="reg-aside" aria-label="Your order">
        <div className="reg-summary">
          <p className="eyebrow">Your pass</p>
          {chosen ? (
            <>
              <p className="display text-step-2 mt-2">{chosen.name}</p>
              <ul className="tier-list mt-4">
                {chosen.includes.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <div className="reg-total">
                <span>Total</span>
                <span className="numeral">{chosen.priceLabel}</span>
              </div>
              {chosen.placeholder ? (
                <p className="reg-flag" role="note">
                  Placeholder price. Real prices are not set yet, so every pass is offered at the test amount. This
                  notice disappears when they are.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted mt-2">Pick a pass to see the total.</p>
          )}
        </div>
      </aside>
    </>
  )
}
