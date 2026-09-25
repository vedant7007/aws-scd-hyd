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
 * The notify form. Registrations are closed, so the only thing the site asks
 * for is an address to write to when they open: one field, an optional set of
 * pass chips, and nothing else. The POST goes to /api/notify, which answers
 * 200 whether or not the address was already on the list.
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
      <div className="nt-card nt-done" role="status">
        <span className="eye">&gt; added to the list</span>
        <h2 className="nt-h2">YOU ARE ON THE LIST</h2>
        <p className="copy">
          We will email <strong className="text-ink">{saved.email}</strong> as soon as registrations open.
        </p>
        {names.length ? <p className="lbl">Interested in: {names.join(' · ')}</p> : null}
        <div className="flex flex-wrap gap-2.5">
          <Link href="/" className="btn btn-primary">
            BACK TO THE EVENT
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEmail(saved.email)
              setPicked(saved.passes)
              writeStore(null)
            }}
          >
            CHANGE EMAIL
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="nt-card" noValidate>
      <div className="fld">
        <label htmlFor={`${ids}-email`}>Your email</label>
        <div className="nt-row">
          <input
            id={`${ids}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="inp nt-input"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids}-err` : undefined}
            placeholder="you@college.edu"
          />
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? 'ADDING YOU' : 'NOTIFY ME'}
          </button>
        </div>
        {error ? (
          <p id={`${ids}-err`} role="alert" className="err-text">
            {error}
          </p>
        ) : null}
      </div>

      {/* Not shown, not tabbable, not announced. A bot fills it, a person cannot. */}
      <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="nt-hp" />

      <div className="flex flex-col gap-2.5">
        <span className="lbl">Eyeing a pass? (optional)</span>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c.id} type="button" className="nt-chip" aria-pressed={picked.includes(c.id)} onClick={() => toggle(c.id)}>
              <span className="nt-sw" style={{ background: c.swatch }} aria-hidden="true" />
              {c.name.toUpperCase()} {c.price}
            </button>
          ))}
        </div>
      </div>

      <p className="hint">One email when registrations open. No spam, no sharing.</p>
    </form>
  )
}
