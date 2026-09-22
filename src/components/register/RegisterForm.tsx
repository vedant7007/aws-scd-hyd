'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import type { FoodPreference, Tier, Track } from '@/lib/db/types'

export type TierOption = {
  id: Tier
  name: string
  priceLabel: string
  /** True while content/passes.ts has no price and the test amount is in force. */
  placeholder: boolean
  includes: string[]
  recommended: boolean
  /** Tracks this tier may pick sessions from, home track included. */
  tracksAllowed: number
}

export type TrackOption = { id: Track; name: string; blurb: string }

const FOODS: { id: FoodPreference; label: string }[] = [
  { id: 'veg', label: 'Veg' },
  { id: 'nonveg', label: 'Non-veg' },
  { id: 'jain', label: 'Jain' },
]

/** What /api/register hands back. */
type Registered = {
  mode: 'manual' | 'razorpay'
  passId: string
  amountPaise: number
  payUrl: string
  order?: { orderId: string; keyId: string; currency: string }
  prefill?: { name: string; email: string; contact: string }
}

type Phase = { kind: 'form' } | { kind: 'creating' } | { kind: 'paying'; reg: Registered } | { kind: 'dismissed'; reg: Registered }

/** Minimal surface of checkout.js. Typed by hand, the script defines a global. Razorpay mode only. */
type RazorpayInstance = { open(): void; on(event: 'payment.failed', handler: (r: { error?: { description?: string } }) => void): void }
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance
declare global {
  interface Window {
    Razorpay?: RazorpayCtor
  }
}
let checkoutJs: Promise<RazorpayCtor> | null = null
function loadCheckout(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  checkoutJs ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
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

/**
 * Step one of registration: the form and the home track. On success the
 * browser goes to the payment page for the new pass id, which is where the
 * student pays, comes back, and enters the UTR. Amendment 1 section 2.
 *
 * The submission key is minted once per mounted form. A double click or a
 * retry after a timeout sends the same key, and the server hands back the
 * record the first one made instead of making a second.
 */
export function RegisterForm({
  tiers,
  tracks,
  preselect,
  eventName,
  contactEmail,
}: {
  tiers: TierOption[]
  tracks: TrackOption[]
  preselect?: Tier
  eventName: string
  contactEmail: string
}) {
  const [tier, setTier] = useState<Tier | ''>(preselect ?? tiers.find((t) => t.recommended)?.id ?? tiers[0]?.id ?? '')
  const [homeTrack, setHomeTrack] = useState<Track | ''>('')
  const [food, setFood] = useState<FoodPreference | ''>('')
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Minted on the first submit and kept for the life of the form, so a retry carries the same key.
  const submissionKey = useRef('')
  const resultRef = useRef<HTMLDivElement>(null)
  const ids = useId()

  const chosen = tiers.find((t) => t.id === tier)
  const busy = phase.kind === 'creating' || phase.kind === 'paying'

  async function openCheckout(reg: Registered) {
    if (!reg.order) return
    setPhase({ kind: 'paying', reg })
    let Razorpay: RazorpayCtor
    try {
      Razorpay = await loadCheckout()
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not load the payment window.' })
      setPhase({ kind: 'dismissed', reg })
      return
    }
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const rzp = new Razorpay({
      key: reg.order.keyId,
      order_id: reg.order.orderId,
      name: eventName,
      description: `${chosen?.name ?? 'Pass'} pass`,
      prefill: reg.prefill,
      theme: { color: accent },
      // Success here is UX only. The server has not heard from Razorpay yet; the pay page shows the truth.
      handler: () => window.location.assign(reg.payUrl),
      modal: { ondismiss: () => setPhase((p) => (p.kind === 'paying' ? { kind: 'dismissed', reg } : p)) },
    })
    rzp.on('payment.failed', (r) => {
      setError({ message: `${r.error?.description ?? 'The payment did not go through.'} Nothing was charged. Try again.` })
      setPhase({ kind: 'dismissed', reg })
    })
    rzp.open()
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (phase.kind === 'dismissed') return openCheckout(phase.reg)

    const fd = new FormData(e.currentTarget)
    const body = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      college: String(fd.get('college') ?? ''),
      tier,
      homeTrack,
      foodPreference: food,
      submissionKey: (submissionKey.current ||= crypto.randomUUID().replace(/-/g, '')),
    }

    setPhase({ kind: 'creating' })
    let res: Response
    try {
      res = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    } catch {
      setError({ message: 'Could not reach the server. Check your connection and try again.' })
      setPhase({ kind: 'form' })
      return
    }
    const data = (await res.json().catch(() => ({}))) as Partial<Registered> & { ok?: boolean; field?: string; message?: string }
    if (res.status === 429) {
      setNotice(data.message ?? 'Too many registrations right now. Nothing was charged. Try again in a while.')
      setPhase({ kind: 'form' })
      return
    }
    if (!res.ok || !data.ok || !data.passId || !data.payUrl) {
      setError({ field: data.field, message: data.message ?? 'Something went wrong. Nothing was charged.' })
      setPhase({ kind: 'form' })
      return
    }
    const reg = data as Registered
    if (reg.mode === 'razorpay') return openCheckout(reg)
    window.location.assign(reg.payUrl)
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : null)

  return (
    <>
      <form onSubmit={onSubmit} onChange={() => phase.kind === 'dismissed' && setPhase({ kind: 'form' })} className="reg-form" noValidate>
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
                <input type="radio" name="tier" value={t.id} checked={tier === t.id} onChange={() => setTier(t.id)} className="choice-input" />
                <span className="choice-body">
                  <span className="choice-head">
                    <span className="choice-name">{t.name}</span>
                    {t.recommended ? <span className="badge">Pick</span> : null}
                  </span>
                  <span className="choice-detail">
                    {t.tracksAllowed >= tracks.length
                      ? 'Sessions from all three tracks'
                      : t.tracksAllowed === 1
                        ? 'Sessions from your track'
                        : `Sessions from your track plus ${t.tracksAllowed - 1} other`}
                    {t.includes.length ? `. ${t.includes.join(', ')}` : ''}
                  </span>
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
          <legend className="eyebrow">Your track</legend>
          <p className="reg-hint">The one you are here for. Places are counted per track, so a full track cannot be picked.</p>
          <div className="choice-list" role="radiogroup" aria-describedby={fieldError('homeTrack') ? `${ids}-track-err` : undefined}>
            {tracks.map((tr) => (
              <label key={tr.id} className="choice" data-checked={homeTrack === tr.id ? 'true' : undefined}>
                <input
                  type="radio"
                  name="homeTrack"
                  value={tr.id}
                  checked={homeTrack === tr.id}
                  onChange={() => setHomeTrack(tr.id)}
                  className="choice-input"
                  required
                />
                <span className="choice-body">
                  <span className="choice-head">
                    <span className="choice-name">{tr.name}</span>
                  </span>
                  <span className="choice-detail">{tr.blurb}</span>
                </span>
              </label>
            ))}
          </div>
          {fieldError('homeTrack') ? <p id={`${ids}-track-err`} className="reg-error">{fieldError('homeTrack')}</p> : null}
        </fieldset>

        <fieldset className="reg-block" disabled={busy}>
          <legend className="eyebrow">Lunch</legend>
          <div className="choice-row" role="radiogroup" aria-describedby={fieldError('foodPreference') ? `${ids}-food-err` : undefined}>
            {FOODS.map((f) => (
              <label key={f.id} className="chip" data-checked={food === f.id ? 'true' : undefined}>
                <input type="radio" name="foodPreference" value={f.id} checked={food === f.id} onChange={() => setFood(f.id)} className="choice-input" required />
                {f.label}
              </label>
            ))}
          </div>
          {fieldError('foodPreference') ? <p id={`${ids}-food-err`} className="reg-error">{fieldError('foodPreference')}</p> : null}
        </fieldset>

        {error && !error.field ? (
          <p role="alert" className="reg-error">
            {error.message}
          </p>
        ) : null}
        {notice ? (
          <div ref={resultRef} role="alert" className="notice">
            <p className="font-semibold">This registration was not started.</p>
            <p className="text-step--1 text-muted">{notice}</p>
          </div>
        ) : null}

        <div className="reg-actions">
          <button type="submit" className="cta" disabled={busy || !tier || !food || !homeTrack}>
            {phase.kind === 'creating'
              ? 'Saving your place'
              : phase.kind === 'paying'
                ? 'Payment window open'
                : phase.kind === 'dismissed'
                  ? 'Try the payment again'
                  : `Continue to pay ${chosen?.priceLabel ?? ''}`}
          </button>
          <p className="text-step--1 text-muted">Next: pay by UPI and send us the UTR. Questions go to {contactEmail}.</p>
        </div>
      </form>

      <aside className="reg-aside" aria-label="Your order">
        <div className="reg-summary">
          <p className="eyebrow">Your pass</p>
          {chosen ? (
            <>
              <p className="display text-step-2 mt-2">{chosen.name}</p>
              {homeTrack ? <p className="text-step--1 text-muted mt-1">{tracks.find((t) => t.id === homeTrack)?.name}</p> : null}
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
                  Placeholder price. Real prices are not set yet, so every pass is offered at the test amount.
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
