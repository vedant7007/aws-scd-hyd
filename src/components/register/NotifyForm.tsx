'use client'

import Link from 'next/link'
import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { Tier } from '@/lib/db/types'

export type PassChip = { id: Tier; name: string; price: string; swatch: string }

/**
 * Whether this browser has already signed up, kept in localStorage so a
 * returning visitor is not asked twice.
 *
 * Read through useSyncExternalStore rather than an effect: the server has no
 * storage, so the first render must be the form either way, and this is the
 * one hook that renders the server snapshot and then the real one without a
 * cascading setState. The snapshot is the raw string on purpose, because a
 * fresh object every read would loop.
 */
const STORE = 'scd-notify'

type Saved = { email: string; passes: Tier[] }

let listeners: (() => void)[] = []

function subscribe(fn: () => void) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

function readStore(): string | null {
  try {
    return localStorage.getItem(STORE)
  } catch {
    // Private window or blocked storage. Nothing remembered, which is fine.
    return null
  }
}

function writeStore(value: Saved | null) {
  try {
    if (value === null) localStorage.removeItem(STORE)
    else localStorage.setItem(STORE, JSON.stringify(value))
  } catch {
    // Not being able to remember is not worth telling anyone about.
  }
  for (const l of listeners) l()
}

function parseStore(raw: string | null): Saved | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<Saved>
    if (typeof v.email !== 'string' || !v.email) return null
    return { email: v.email, passes: Array.isArray(v.passes) ? v.passes : [] }
  } catch {
    return null
  }
}

/**
 * The notify form, in the v3 handoff's markup: one field and its button on a
 * line, optional pass chips, and a mint card once the address is on the list.
 * The handoff only saved to localStorage; this posts to /api/notify, which
 * answers 200 whether or not the address was already there.
 */
export function NotifyForm({ chips }: { chips: PassChip[] }) {
  const saved = parseStore(useSyncExternalStore(subscribe, readStore, () => null))
  const [sending, setSending] = useState(false)
  const [picked, setPicked] = useState<Tier[]>([])
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const ids = useId()
  const honeypot = useRef<HTMLInputElement>(null)

  const toggle = (id: Tier) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    // Lowercased here as well as on the server, so the address the success
    // state shows back is the one that actually went on the list.
    const value = email.trim().toLowerCase()
    if (!value) return setError('Type your email first.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return setError('That does not look like an email. Check for typos.')

    setSending(true)
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: value, interestedPasses: picked, company: honeypot.current?.value ?? '' }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'That did not go through. Try again in a moment.')
        return
      }
      writeStore({ email: value, passes: picked })
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (saved) {
    const names = chips.filter((c) => saved.passes.includes(c.id)).map((c) => c.name.toUpperCase())
    return (
      <div
        role="status"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '3px solid var(--line)', background: '#9FE3B6', color: '#14161C', padding: 'clamp(18px,3vw,26px)', boxShadow: '8px 8px 0 var(--line)', animation: 'rg-pop .45s cubic-bezier(.2,.9,.3,1.25) both' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: '600' }}>{'> added to the list'}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,7vw,48px)', lineHeight: '.95' }}>{"YOU'RE ON THE LIST"}</span>
        <span style={{ fontSize: '15px', lineHeight: '1.55' }}>
          We will email <strong style={{ wordBreak: 'break-all' }}>{saved.email}</strong> as soon as registrations open.
        </span>
        {names.length ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '.06em' }}>Interested in: {names.join(' · ')}</span> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: '46px', padding: '0 18px', background: '#14161C', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontSize: '21px' }}>
            BACK TO THE EVENT
          </Link>
          <button
            type="button"
            onClick={() => {
              setEmail(saved.email)
              setPicked(saved.passes)
              writeStore(null)
            }}
            style={{ minHeight: '46px', padding: '0 16px', background: 'transparent', border: '3px solid #14161C', color: '#14161C', fontFamily: 'var(--font-display)', fontSize: '20px', cursor: 'pointer' }}
          >
            CHANGE EMAIL
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '3px solid var(--line)', background: 'var(--surface)', padding: 'clamp(18px,3vw,26px)', boxShadow: '8px 8px 0 var(--sh)' }}
    >
      <label htmlFor={`${ids}-email`} style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        Your email
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <input
          id={`${ids}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@college.edu"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids}-err` : undefined}
          style={{ flex: '1 1 220px', minWidth: '0', minHeight: '54px', padding: '0 16px', border: '3px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '16px', boxSizing: 'border-box' }}
        />
        <button
          type="submit"
          disabled={sending}
          className="rg-cta"
          style={{ flex: '0 0 auto', minHeight: '54px', padding: '0 22px', background: '#FF9900', color: '#14161C', border: '3px solid var(--line)', fontFamily: 'var(--font-display)', fontSize: '24px', boxShadow: '5px 5px 0 var(--line)', cursor: 'pointer', transition: 'transform .1s steps(2),box-shadow .1s steps(2)' }}
        >
          {sending ? 'ADDING YOU' : 'NOTIFY ME'}
        </button>
      </div>
      {error ? (
        <span id={`${ids}-err`} role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: 'var(--err-ink)' }}>
          {error}
        </span>
      ) : null}

      {/* Not shown, not tabbable, not announced. A bot fills it, a person cannot. */}
      <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="nt-hp" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>Eyeing a pass? (optional)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {chips.map((c) => {
            const on = picked.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className="rg-chip"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 13px', border: '3px solid var(--line)', background: on ? 'var(--ink-fill)' : 'transparent', color: on ? 'var(--bg)' : 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: '19px', cursor: 'pointer', transition: 'transform .1s steps(2)' }}
              >
                <span aria-hidden="true" style={{ width: '10px', height: '10px', background: c.swatch, border: '2px solid var(--line)' }}></span>
                {c.name.toUpperCase()}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{c.price}</span>
              </button>
            )
          })}
        </div>
      </div>
      <span style={{ fontSize: '12.5px', lineHeight: '1.55', color: 'var(--muted)' }}>One email when registrations open. No spam, no sharing.</span>
    </form>
  )
}
