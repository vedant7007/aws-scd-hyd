'use client'

import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import { levelOf, ordinal, referralPath, score } from '@/content/referral'

type Me = { name: string; last: string; code: string | null; count: number; rank: number | null; referredBy: { code: string; name: string | null } | null; open: boolean }
type Err = { field?: string; message: string } | null

async function call<T>(body: Record<string, string>): Promise<{ ok: true; data: T } | { ok: false; field?: string; message: string }> {
  try {
    const res = await fetch('/api/referrals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const b = (await res.json().catch(() => ({}))) as T & { ok?: boolean; field?: string; message?: string }
    return res.ok && b.ok ? { ok: true, data: b } : { ok: false, field: b.field, message: b.message ?? 'That did not work. Try again.' }
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection and try again.' }
  }
}

/**
 * The referral desk. Pass ID and email first (both are in the registration
 * email); then pick a code from suggestions, share it, and, for anyone who
 * registered without one, say who referred you.
 */
export function RefDesk({ initialPass }: { initialPass: string }) {
  const [pass, setPass] = useState(initialPass)
  const [email, setEmail] = useState('')
  const [me, setMe] = useState<Me | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<Err>(null)

  const who = { passId: pass, email }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const out = await call<Me>({ action: 'me', ...who })
    setBusy(false)
    if (out.ok) setMe(out.data)
    else setErr(out)
  }

  if (!me) {
    return (
      <form onSubmit={signIn} noValidate className="card flex flex-col gap-4 p-5">
        <span className="h3">FIRST, FIND YOUR REGISTRATION</span>
        <div className="fld">
          <label htmlFor="rf-pass">Your pass ID</label>
          <input id="rf-pass" className="inp inp-num" value={pass} onChange={(e) => setPass(e.currentTarget.value.toUpperCase())} placeholder="SCD-XXXXXXXXXX" autoCapitalize="characters" autoComplete="off" aria-invalid={err?.field === 'pass'} />
        </div>
        <div className="fld">
          <label htmlFor="rf-email">The email you registered with</label>
          <input id="rf-email" className="inp" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} placeholder="you@example.com" autoComplete="email" aria-invalid={err?.field === 'pass'} />
          <span className="hint">Both are in your registration email. Not registered yet? <Link href="/register">Register first</Link>, then come back for your code.</span>
        </div>
        {err ? (
          <p role="alert" className="err-text">
            {err.message}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary self-start" disabled={busy || !pass || !email}>
          {busy ? 'FINDING' : 'CONTINUE >'}
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {me.code ? <MyCode me={me} code={me.code} /> : <PickCode who={who} first={me.name} onClaimed={(code) => setMe({ ...me, code, count: 0, rank: null })} />}
      <ReferredBy who={who} me={me} onAdded={(referredBy) => setMe({ ...me, referredBy })} />
    </div>
  )
}

/** A word in, four or five free codes out, one tap to take one. */
function PickCode({ who, first, onClaimed }: { who: Record<string, string>; first: string; onClaimed: (code: string) => void }) {
  const [want, setWant] = useState(first)
  const [options, setOptions] = useState<string[] | null>(null)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<Err>(null)

  const suggest = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setPick('')
    const out = await call<{ suggestions: string[] }>({ action: 'suggest', ...who, want })
    setBusy(false)
    if (out.ok) setOptions(out.data.suggestions)
    else {
      setOptions(null)
      setErr(out)
    }
  }

  const claim = async () => {
    setBusy(true)
    setErr(null)
    const out = await call<{ code: string }>({ action: 'claim', ...who, code: pick })
    setBusy(false)
    if (out.ok) onClaimed(out.data.code)
    else setErr(out)
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="rf-pick-h">
      <span id="rf-pick-h" className="h3">
        HI {first.toUpperCase()}, PICK YOUR CODE
      </span>
      <form onSubmit={suggest} noValidate className="flex flex-col gap-3">
        <div className="fld">
          <label htmlFor="rf-want">A word for your code</label>
          <input id="rf-want" className="inp inp-num" value={want} onChange={(e) => setWant(e.currentTarget.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12))} placeholder="YOURNAME" autoComplete="off" aria-invalid={err?.field === 'want'} />
          <span className="hint">Your name or nickname works best. Letters and numbers only. We will show you codes you can take.</span>
        </div>
        <button type="submit" className="btn self-start" disabled={busy || !want}>
          {busy && !pick ? 'LOOKING' : options ? 'SHOW OTHERS' : 'SHOW ME CODES'}
        </button>
      </form>

      {options ? (
        <div className="flex flex-col gap-3">
          <span className="lbl">Pick a cartridge</span>
          <div className="carts" role="radiogroup" aria-label="Available codes">
            {options.map((o, i) => (
              <button key={o} type="button" role="radio" aria-checked={pick === o} className="cart" style={{ '--i': i } as CSSProperties} onClick={() => setPick(o)}>
                <span className="cart-label">{o}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary self-start" disabled={busy || !pick} onClick={claim}>
            {pick ? (busy ? 'LOCKING IT IN' : `LOCK IN ${pick} >`) : 'PICK ONE ABOVE'}
          </button>
          <span className="hint">You get one code and it cannot be changed, so pick one you like.</span>
        </div>
      ) : null}

      {err ? (
        <p role="alert" className="err-text">
          {err.message}
        </p>
      ) : null}
    </section>
  )
}

/** The player card: their code, score, place and level, then every way to send the link. */
function MyCode({ me, code }: { me: Me; code: string }) {
  const [copied, setCopied] = useState('')
  const link = `${typeof window === 'undefined' ? '' : window.location.origin}${referralPath(code)}`
  const message = `I'm going to AWS Student Community Day Hyderabad on 30 October at VJIT. Register with my code ${code}: ${link}`
  const lv = levelOf(me.count)
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      // Clipboard blocked: the text is on screen to copy by hand.
    }
  }
  return (
    <div className="flex flex-col gap-5">
      <article className="pc" data-level={lv.level.name} aria-label={`Your player card, code ${code}`}>
        <div className="pc-in">
          <div className="pc-head">
            <span className="pc-level">{lv.level.name}</span>
            <span className="pc-brand">SCD.HYD26 PLAYER</span>
          </div>
          <div className="pc-art" aria-hidden="true">
            <span className="pc-initial">{me.name.slice(0, 1).toUpperCase()}</span>
          </div>
          <span className="pc-name">
            {me.name} {me.last.slice(0, 1).toUpperCase()}.
          </span>
          <div className="flex flex-col gap-1">
            <span className="pc-code-l">Referral code</span>
            <span className="pc-code">{code}</span>
          </div>
          <div className="pc-stats">
            <span className="pc-stat">
              <b>{score(me.count)}</b>
              <small>REFERRALS</small>
            </span>
            <span className="pc-stat">
              <b>{me.rank ? ordinal(me.rank) : '---'}</b>
              <small>ON THE BOARD</small>
            </span>
          </div>
          <div className="pc-xp">
            <span className="pc-bar" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} data-on={i < Math.round(lv.progress * 10) ? '1' : undefined} />
              ))}
            </span>
            <span className="pc-xp-l">{lv.next ? `${lv.toNext} more to ${lv.next.name}` : 'Max level. Legend.'}</span>
          </div>
        </div>
      </article>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="rf-share-h">
        <span id="rf-share-h" className="h3">
          SEND YOUR LINK
        </span>
        <span className="share-link">{link}</span>
        <div className="share">
          <button type="button" className="btn btn-primary" onClick={() => copy('link', link)}>
            {copied === 'link' ? 'COPIED ✓' : 'COPY LINK'}
          </button>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener">
            WHATSAPP
          </a>
          <button type="button" className="btn" onClick={() => copy('msg', message)}>
            {copied === 'msg' ? 'COPIED ✓' : 'COPY MESSAGE'}
          </button>
          <Link href="/leaderboard" className="btn">
            LEADERBOARD
          </Link>
        </div>
        <span className="hint">Friends can also type {code} in the referral box when they register.</span>
      </section>
    </div>
  )
}

/** "Someone told me about it": the code of whoever referred you, added once. */
function ReferredBy({ who, me, onAdded }: { who: Record<string, string>; me: Me; onAdded: (r: Me['referredBy']) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<Err>(null)

  if (me.referredBy) {
    return (
      <p className="hint">
        You registered with <strong>{me.referredBy.code}</strong>
        {me.referredBy.name ? `, the code of ${me.referredBy.name.replace(/\.$/, '')}` : ''}. You count for them.
      </p>
    )
  }
  if (!me.open) return null

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const out = await call<{ code: string; name: string }>({ action: 'add', ...who, code })
    setBusy(false)
    if (out.ok) onAdded({ code: out.data.code, name: out.data.name })
    else setErr(out)
  }

  return (
    <form onSubmit={add} noValidate className="card flex flex-col gap-3 p-5">
      <span className="h3">DID SOMEONE REFER YOU?</span>
      <p className="copy">If a friend told you about the event and you registered without their code, add it here so they get the credit. You can do this once.</p>
      <div className="fld">
        <label htmlFor="rf-their">Their referral code</label>
        <input id="rf-their" className="inp inp-num" value={code} onChange={(e) => setCode(e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))} placeholder="FRIENDSCODE" autoComplete="off" aria-invalid={Boolean(err)} />
      </div>
      {err ? (
        <p role="alert" className="err-text">
          {err.message}
        </p>
      ) : null}
      <button type="submit" className="btn self-start" disabled={busy || code.length < 4}>
        {busy ? 'ADDING' : 'ADD THEIR CODE'}
      </button>
    </form>
  )
}
