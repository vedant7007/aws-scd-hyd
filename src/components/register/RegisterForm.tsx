'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'
import { YEARS_OF_STUDY, type FoodPreference, type Tier, type Track, type YearOfStudy } from '@/lib/db/types'

export type TierOption = {
  id: Tier
  name: string
  priceLabel: string
  /** The early bird price, set only while the pool has places. */
  earlyPriceLabel: string | null
  /** True while content/passes.ts has no price and the test amount is in force. */
  placeholder: boolean
  includes: string[]
  recommended: boolean
  /** Tracks this tier may pick sessions from, home track included. */
  tracksAllowed: number
}

export type TrackOption = { id: Track; name: string; blurb: string }

const FOODS: { id: FoodPreference; label: string }[] = [
  { id: 'veg', label: 'VEG' },
  { id: 'nonveg', label: 'NON-VEG' },
]

const YEAR_LABEL: Record<YearOfStudy, string> = { '1': '1st year', '2': '2nd year', '3': '3rd year', '4': '4th year', other: 'Other' }

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

const DETAIL_FIELDS = ['name', 'email', 'phone', 'college', 'yearOfStudy'] as const

/**
 * Step one of registration: the form and the home track. On success the
 * browser goes to the payment page for the new pass id, which is where the
 * student pays, comes back, and enters the UTR. Amendment 1 section 2.
 *
 * The submission key is minted once per mounted form. A double click or a
 * retry after a timeout sends the same key, and the server hands back the
 * record the first one made instead of making a second.
 *
 * Laid out as the handoff's Register screen: four numbered steps down one
 * column and a fixed bar at the foot carrying the total and the one button.
 * Everything typed here is validated again on the server.
 */
export function RegisterForm({
  tiers,
  tracks,
  preselect,
  eventName,
  contactEmail,
  earlyBird,
  refundPolicy,
}: {
  tiers: TierOption[]
  tracks: TrackOption[]
  preselect?: Tier
  eventName: string
  contactEmail: string
  /** The pool as read on this request. Null once empty, and then nothing of it is drawn. */
  earlyBird: { left: number; total: number } | null
  refundPolicy: string
}) {
  const [tier, setTier] = useState<Tier | ''>(preselect ?? tiers.find((t) => t.recommended)?.id ?? tiers[0]?.id ?? '')
  const [homeTrack, setHomeTrack] = useState<Track | ''>('')
  const [food, setFood] = useState<FoodPreference | ''>('')
  const [over18, setOver18] = useState(false)
  const [detailsDone, setDetailsDone] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Minted on the first submit and kept for the life of the form, so a retry carries the same key.
  const submissionKey = useRef('')
  const ids = useId()
  const formId = `${ids}-form`

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
      yearOfStudy: String(fd.get('yearOfStudy') ?? ''),
      tier,
      homeTrack,
      foodPreference: food,
      over18,
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

  // Presentation only: the step bars at the top follow what has been filled in.
  function onChange(e: FormEvent<HTMLFormElement>) {
    if (phase.kind === 'dismissed') setPhase({ kind: 'form' })
    const fd = new FormData(e.currentTarget)
    setDetailsDone(DETAIL_FIELDS.every((f) => String(fd.get(f) ?? '').trim() !== ''))
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : null)
  const done = [Boolean(tier), detailsDone, Boolean(homeTrack), Boolean(food) && over18]
  const payLabel = (t: TierOption) => t.earlyPriceLabel ?? t.priceLabel
  const now = done.indexOf(false)
  const coverage = (t: TierOption) =>
    t.tracksAllowed >= tracks.length
      ? 'Sessions from all three tracks'
      : t.tracksAllowed === 1
        ? 'Sessions from your track'
        : `Sessions from your track plus ${t.tracksAllowed - 1} other`

  const submitLabel =
    phase.kind === 'creating'
      ? 'SAVING YOUR PLACE'
      : phase.kind === 'paying'
        ? 'PAYMENT WINDOW OPEN'
        : phase.kind === 'dismissed'
          ? 'TRY THE PAYMENT AGAIN'
          : 'CONTINUE >'

  return (
    <>
      <form id={formId} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-[clamp(26px,5vh,40px)]" noValidate>
        <div className="steps" aria-hidden="true">
          {done.map((d, i) => (
            <span key={i} data-state={d ? 'done' : i === now ? 'now' : undefined} />
          ))}
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={busy}>
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="eye">STEP 01 OF 04</span>
            <span className="lbl">Choose a pass</span>
          </legend>
          <h2 className="h1">PICK YOUR PASS</h2>
          {earlyBird ? (
            <p className="pill self-start" role="status">
              {earlyBird.left} of {earlyBird.total} early bird places left
            </p>
          ) : null}
          <div className="flex flex-col gap-3" role="radiogroup" aria-label="Pass" aria-describedby={fieldError('tier') ? `${ids}-tier-err` : undefined}>
            {tiers.map((t) => {
              const on = tier === t.id
              return (
                <label key={t.id} className="opt" data-on={on ? 'true' : undefined}>
                  <input type="radio" name="tier" value={t.id} checked={on} onChange={() => setTier(t.id)} className="sr-only" />
                  <span className="opt-row">
                    <span className="opt-title opt-title-lg uppercase">{t.name}</span>
                    <span className="price">
                      {t.earlyPriceLabel ? (
                        <>
                          <s className="mr-2 opacity-55">{t.priceLabel}</s>
                          {t.earlyPriceLabel}
                        </>
                      ) : (
                        t.priceLabel
                      )}
                    </span>
                  </span>
                  <span className="opt-copy">
                    {coverage(t)}
                    {t.includes.length ? `. ${t.includes.join(', ')}` : ''}.
                  </span>
                  <span className="opt-row">
                    <span className="opt-mark" data-tone={t.placeholder ? 'err' : undefined}>
                      {t.placeholder ? 'Test price, placeholder' : ''}
                    </span>
                    <span className="opt-mark" data-tone={on ? 'ink' : 'warn'}>
                      {on ? 'Picked' : t.recommended ? 'Our pick' : ''}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          {fieldError('tier') ? (
            <p id={`${ids}-tier-err`} className="err-text">
              {fieldError('tier')}
            </p>
          ) : null}
          <p className="hint">
            Lunch is included on every tier. Swag level rises with the tier, and what is in it stays sealed until the day.{' '}
            <Link href="/#passes">See the full tier comparison</Link>
          </p>
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={busy}>
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="eye">STEP 02 OF 04</span>
            <span className="lbl">Your details</span>
          </legend>
          <h2 className="h1">WHO IS COMING?</h2>
          <p className="hint">
            Every field is required. <span className="req">*</span> marks a required field.
          </p>
          <div className="card flex flex-col gap-4 p-4">
            <div className="fld">
              <label htmlFor={`${ids}-name`}>
                Name <span className="req">*</span>
              </label>
              <input
                id={`${ids}-name`}
                name="name"
                className="inp"
                autoComplete="name"
                required
                maxLength={80}
                aria-invalid={fieldError('name') ? true : undefined}
                aria-describedby={`${ids}-name-hint${fieldError('name') ? ` ${ids}-name-err` : ''}`}
              />
              <p id={`${ids}-name-hint`} className="hint">
                This is the name on your pass.
              </p>
              {fieldError('name') ? (
                <p id={`${ids}-name-err`} className="err-text">
                  {fieldError('name')}
                </p>
              ) : null}
            </div>
            <div className="fld">
              <label htmlFor={`${ids}-email`}>
                Email <span className="req">*</span>
              </label>
              <input
                id={`${ids}-email`}
                name="email"
                type="email"
                className="inp"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={254}
                aria-invalid={fieldError('email') ? true : undefined}
                aria-describedby={`${ids}-email-hint${fieldError('email') ? ` ${ids}-email-err` : ''}`}
              />
              <p id={`${ids}-email-hint`} className="hint">
                Your pass is sent here. Check it twice, we cannot move a pass to another address.
              </p>
              {fieldError('email') ? (
                <p id={`${ids}-email-err`} className="err-text">
                  {fieldError('email')}
                </p>
              ) : null}
            </div>
            <div className="fld">
              <label htmlFor={`${ids}-phone`}>
                Phone number <span className="req">*</span>
              </label>
              <div className="flex items-stretch">
                <span className="inp-prefix" aria-hidden="true">
                  +91
                </span>
                <input
                  id={`${ids}-phone`}
                  name="phone"
                  type="tel"
                  className="inp"
                  autoComplete="tel"
                  inputMode="numeric"
                  required
                  aria-invalid={fieldError('phone') ? true : undefined}
                  aria-describedby={`${ids}-phone-hint${fieldError('phone') ? ` ${ids}-phone-err` : ''}`}
                />
              </div>
              <p id={`${ids}-phone-hint`} className="hint">
                Ten digits, India.
              </p>
              {fieldError('phone') ? (
                <p id={`${ids}-phone-err`} className="err-text">
                  {fieldError('phone')}
                </p>
              ) : null}
            </div>
            <div className="fld">
              <label htmlFor={`${ids}-college`}>
                College <span className="req">*</span>
              </label>
              <input
                id={`${ids}-college`}
                name="college"
                className="inp"
                autoComplete="organization"
                placeholder="Any college in Hyderabad"
                required
                maxLength={120}
                aria-invalid={fieldError('college') ? true : undefined}
                aria-describedby={fieldError('college') ? `${ids}-college-err` : undefined}
              />
              {fieldError('college') ? (
                <p id={`${ids}-college-err`} className="err-text">
                  {fieldError('college')}
                </p>
              ) : null}
            </div>
            <div className="fld">
              <label htmlFor={`${ids}-year`}>
                Year of study <span className="req">*</span>
              </label>
              <select
                id={`${ids}-year`}
                name="yearOfStudy"
                className="inp"
                required
                defaultValue=""
                aria-invalid={fieldError('yearOfStudy') ? true : undefined}
                aria-describedby={fieldError('yearOfStudy') ? `${ids}-year-err` : undefined}
              >
                <option value="" disabled>
                  Pick one
                </option>
                {YEARS_OF_STUDY.map((y) => (
                  <option key={y} value={y}>
                    {YEAR_LABEL[y]}
                  </option>
                ))}
              </select>
              {fieldError('yearOfStudy') ? (
                <p id={`${ids}-year-err`} className="err-text">
                  {fieldError('yearOfStudy')}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={busy}>
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="eye">STEP 03 OF 04</span>
            <span className="lbl">Your track</span>
          </legend>
          <h2 className="h1">BUILD YOUR DAY</h2>
          <div className="card-dash flex flex-col gap-1.5 px-4 py-3.5">
            <span className="lbl eye-amber">
              {chosen ? `Your ${chosen.name} pass covers ${chosen.tracksAllowed} track${chosen.tracksAllowed > 1 ? 's' : ''} of ${tracks.length}` : 'Pick a pass first'}
            </span>
            <p className="copy">
              The one you are here for. Places are counted per track, so a full track cannot be picked.
              {chosen && chosen.tracksAllowed > 1
                ? ` When sessions open you can also pick from ${chosen.tracksAllowed >= tracks.length ? 'the other tracks' : 'one other track'}.`
                : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Your track" aria-describedby={fieldError('homeTrack') ? `${ids}-track-err` : undefined}>
            {tracks.map((tr) => {
              const on = homeTrack === tr.id
              return (
                <label key={tr.id} className="opt" data-on={on ? 'true' : undefined}>
                  <input type="radio" name="homeTrack" value={tr.id} checked={on} onChange={() => setHomeTrack(tr.id)} className="sr-only" required />
                  <span className="opt-row">
                    <span className="flex items-center gap-2.5">
                      <span className="dot" data-track={tr.id} aria-hidden="true" />
                      <span className="opt-title uppercase">{tr.name}</span>
                    </span>
                    <span className="opt-mark" data-tone="ok">
                      {on ? 'Picked' : ''}
                    </span>
                  </span>
                  <span className="opt-note">{tr.blurb}</span>
                </label>
              )
            })}
          </div>
          {fieldError('homeTrack') ? (
            <p id={`${ids}-track-err`} className="err-text">
              {fieldError('homeTrack')}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={busy}>
          <legend className="flex w-full items-baseline justify-between gap-3">
            <span className="eye">STEP 04 OF 04</span>
            <span className="lbl">Lunch</span>
          </legend>
          <h2 className="h1">WHAT DO YOU EAT?</h2>
          <div className="card flex flex-col gap-3 p-4">
            <p className="hint">This count goes straight to the caterer. Pick carefully, it cannot be changed on the day.</p>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]" role="radiogroup" aria-label="Lunch" aria-describedby={fieldError('foodPreference') ? `${ids}-food-err` : undefined}>
              {FOODS.map((f) => (
                <label key={f.id} className="tog" data-on={food === f.id ? 'true' : undefined}>
                  <input type="radio" name="foodPreference" value={f.id} checked={food === f.id} onChange={() => setFood(f.id)} className="sr-only" required />
                  {f.label}
                </label>
              ))}
            </div>
            {fieldError('foodPreference') ? (
              <p id={`${ids}-food-err`} className="err-text">
                {fieldError('foodPreference')}
              </p>
            ) : null}
          </div>
          <div className="panel flex flex-col gap-2 p-4">
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" name="over18" checked={over18} onChange={(e) => setOver18(e.target.checked)} className="sr-only" required />
              <span className="tick" data-on={over18 ? 'true' : undefined} aria-hidden="true">
                {over18 ? 'x' : ''}
              </span>
              <span className="copy pt-0.5 text-ink">I will be 18 or older on the day of the event.</span>
            </label>
            {fieldError('over18') ? <p className="err-text">{fieldError('over18')}</p> : null}
          </div>
        </fieldset>

        {error && !error.field ? (
          <div role="alert" className="notice-err">
            <span className="notice-title">THAT DID NOT GO THROUGH</span>
            <p className="copy">{error.message}</p>
          </div>
        ) : null}
        {notice ? (
          <div role="alert" className="notice-err">
            <span className="notice-title">NOT STARTED</span>
            <p className="copy">{notice}</p>
          </div>
        ) : null}

        <div className="card-dash flex flex-col gap-2 p-4">
          <span className="lbl eye-amber">What happens next</span>
          <p className="copy">
            You pay by UPI from your own app on the next screen, then send us the UTR and a screenshot. We check it against the bank
            statement and email your pass link.
          </p>
          <p className="copy">{refundPolicy}</p>
          <p className="hint">Questions go to {contactEmail}.</p>
        </div>
      </form>

      <div className="bar-fixed">
        <div className="bar-fixed-in">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="bar-lbl truncate">
              {chosen ? chosen.name : 'No pass picked'}
              {homeTrack ? ` · ${tracks.find((t) => t.id === homeTrack)?.name ?? ''}` : ''}
            </span>
            <span className="bar-val">{chosen ? payLabel(chosen) : '-'}</span>
          </div>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy || !tier || !food || !homeTrack || !over18}>
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}
