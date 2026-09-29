'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'
import { SPEAKER_FORM, type Question } from '@/lib/forms-options'

/**
 * The speaker interest form, in the organisers' own wording, drawn in the
 * v3 handoff's form style (the Speak screen's fields, chips and cards).
 * Rendered from SPEAKER_FORM, the same list the server checks against.
 */

type Value = string | string[] | boolean
const LABEL: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', lineHeight: '1.5' }
const ERR: CSSProperties = { fontSize: '12.5px', color: 'var(--err-ink)', minHeight: '1px' }
const HINT: CSSProperties = { fontSize: '12px', lineHeight: '1.5', color: 'var(--muted)' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

const chip = (on: boolean): CSSProperties => ({
  minHeight: '50px', padding: '0 12px', fontFamily: 'var(--font-display)', fontSize: '20px',
  border: `3px solid ${on ? '#FF9900' : 'var(--line)'}`, background: on ? '#FF9900' : 'transparent', color: on ? '#14161C' : 'var(--ink)',
})
const card = (on: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '12px', minHeight: '56px', width: '100%',
  border: on ? '4px solid #FF9900' : '3px solid var(--line-soft)', background: on ? 'var(--panel-mint)' : 'var(--surface)', color: 'var(--ink)',
})
const box = (on: boolean): CSSProperties => ({
  flex: 'none', width: '22px', height: '22px', border: '3px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-display)', fontSize: '19px', ...(on ? { background: '#FF9900', color: '#14161C' } : { background: 'var(--surface)', color: 'transparent' }),
})

/** The browser's check, the same rules as validateForm on the server. */
function problem(q: Question, v: Value | undefined): string {
  if (q.kind === 'check') return q.required && v !== true ? 'Tick this to send the form.' : ''
  if (q.kind === 'multi') return q.required && !(Array.isArray(v) && v.length) ? 'Pick at least one.' : ''
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return q.required ? (q.kind === 'choice' ? 'Pick one.' : 'This one is needed.') : ''
  if (q.kind === 'email' && !EMAIL.test(s)) return 'That does not look like a working email.'
  if (q.kind === 'tel' && s.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '').length !== 10) return 'Enter exactly 10 digits, no +91.'
  return ''
}

/** Module level on purpose: defined inside the form, it would remount its input on every keystroke. */
function Field({ q, value, error, set }: { q: Question; value: Value | undefined; error?: string; set: (v: Value) => void }) {
  const id = `sp-${q.id}`
  const req = q.required ? <span style={{ color: 'var(--err-ink)' }}> *</span> : null
  const text = typeof value === 'string' ? value : ''

  if (q.kind === 'check') {
    const on = value === true
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button id={id} type="button" role="checkbox" aria-checked={on} onClick={() => set(!on)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'transparent', border: '0', padding: '4px 0', textAlign: 'left' }}>
          <span aria-hidden="true" style={box(on)}>
            x
          </span>
          <span style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--ink)' }}>
            {q.label}
            {req}
          </span>
        </button>
        <span style={ERR}>{error}</span>
      </div>
    )
  }

  if (q.kind === 'choice' || q.kind === 'multi') {
    const multi = q.kind === 'multi'
    const picked = multi ? (Array.isArray(value) ? value : []) : [text]
    const toggle = (oid: string) => set(multi ? (picked.includes(oid) ? picked.filter((x) => x !== oid) : [...picked, oid]) : oid)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span id={`${id}-l`} style={LABEL}>
          {q.label}
          {req}
        </span>
        {q.hint ? <span style={HINT}>{q.hint}</span> : null}
        <div id={id} role={multi ? 'group' : 'radiogroup'} aria-labelledby={`${id}-l`} tabIndex={-1} style={multi ? { display: 'flex', flexDirection: 'column', gap: '8px' } : { display: 'grid', gap: '9px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,130px),1fr))' }}>
          {(q.options ?? []).map((o, i, list) => {
            const on = picked.includes(o.id)
            const heading = o.group && o.group !== list[i - 1]?.group ? o.group : ''
            return multi ? (
              <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {heading ? <span style={{ ...LABEL, color: 'var(--mint-ink)', paddingTop: '6px' }}>{heading}</span> : null}
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.id)} style={card(on)}>
                  <span aria-hidden="true" style={box(on)}>
                    x
                  </span>
                  <span style={{ fontSize: '14.5px', lineHeight: '1.4' }}>{o.label}</span>
                </button>
              </div>
            ) : (
              <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => toggle(o.id)} style={chip(on)}>
                {o.label.toUpperCase()}
              </button>
            )
          })}
        </div>
        <span style={ERR}>{error}</span>
      </div>
    )
  }

  const common = {
    id,
    className: 'inp',
    defaultValue: text,
    onChange: (e: { currentTarget: { value: string } }) => set(e.currentTarget.value),
    placeholder: q.placeholder,
    'aria-invalid': Boolean(error),
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <label htmlFor={id} style={LABEL}>
        {q.label}
        {req}
      </label>
      {q.hint ? <span style={HINT}>{q.hint}</span> : null}
      {q.kind === 'textarea' ? (
        <textarea {...common} style={{ minHeight: '110px', resize: 'vertical' }} />
      ) : q.kind === 'tel' ? (
        <div style={{ display: 'flex' }}>
          <span className="inp-prefix" style={{ fontSize: '14px', padding: '0 12px' }}>
            +91
          </span>
          <input {...common} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" />
        </div>
      ) : (
        <input {...common} type={q.kind} inputMode={q.kind === 'url' ? 'url' : q.kind === 'email' ? 'email' : undefined} autoComplete={q.id === 'name' ? 'name' : q.kind === 'email' ? 'email' : undefined} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <span style={ERR}>{error}</span>
        {q.words ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', flex: 'none' }}>{words(text)} words</span> : null}
      </div>
    </div>
  )
}

export function SpeakerForm() {
  const [values, setValues] = useState<Record<string, Value>>({})
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ ref: string; email: string } | null>(null)
  const [formKey, setFormKey] = useState(0)
  const honeypot = useRef<HTMLInputElement>(null)
  const all = SPEAKER_FORM.flatMap((s) => s.questions)

  const set = (id: string) => (v: Value) => {
    setValues((p) => ({ ...p, [id]: v }))
    setErr((e) => (id in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)) : e))
  }

  async function submit() {
    if (busy) return
    const e = Object.fromEntries(all.map((q) => [q.id, problem(q, values[q.id])]).filter(([, m]) => m))
    if (Object.keys(e).length) {
      setErr(e)
      const first = all.find((q) => e[q.id])
      document.getElementById(`sp-${first?.id}`)?.focus()
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ form: 'speak', ...values, company: honeypot.current?.value ?? '' }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; field?: string; message?: string }
      if (res.ok && body.ok && body.ref) {
        setSent({ ref: body.ref, email: String(values.email ?? '').trim() })
        window.scrollTo(0, 0)
        return
      }
      setErr({ [body.field ?? 'form']: body.message ?? 'Something went wrong on our side. Try again, or write to awssbgvjit@gmail.com.' })
    } catch {
      setErr({ form: 'Could not reach the server. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-dc="1" style={{ position: 'relative', zIndex: '10', width: '100%', maxWidth: '760px', margin: '0 auto', padding: 'clamp(22px,6vw,44px) clamp(16px,5vw,28px) 80px', display: 'flex', flexDirection: 'column', gap: '22px', boxSizing: 'border-box' }}>
      {!sent ? (
        <div key={formKey} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mint-ink)' }}>{'// CALL FOR SPEAKERS'}</span>
            <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,10vw,60px)', lineHeight: '1', color: 'var(--ink)' }}>SPEAKER INTEREST FORM</h1>
            <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', color: 'var(--body)', maxWidth: '58ch' }}>
              The sessions for the day are already set. Tell us which one you would like to take, and a little about you.
            </p>
          </div>

          <div role="note" style={{ border: '4px solid #FF9900', background: 'var(--panel-gold)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--amber-ink)' }}>Speaker participation note</span>
            <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.6', color: 'var(--body)' }}>
              Speaking at AWS Student Community Day Hyderabad 2026 is a voluntary community contribution. Submission of this form does not guarantee selection as a speaker. The organising team will confirm the final speaker lineup, session allocation, format and schedule after review.
            </p>
            <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.6', color: 'var(--body)' }}>
              At this stage, travel, accommodation, transportation or other personal expenses are not included as part of speaker participation. If any support is available for selected speakers, it will be communicated and discussed with the organising team separately on a case-by-case basis.
            </p>
            <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.6', color: 'var(--body)' }}>We will share all confirmed event, session and speaker details with selected speakers well in advance.</p>
          </div>

          <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="nt-hp" />
          {SPEAKER_FORM.map((sec, i) => (
            <section key={sec.title} aria-labelledby={`sp-sec-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '18px', border: '3px solid var(--line)', background: 'var(--surface)', padding: 'clamp(18px,5vw,26px)' }}>
              <h2 id={`sp-sec-${i}`} style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,6vw,30px)', lineHeight: '1', color: 'var(--ink)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.2em', color: 'var(--mint-ink)', display: 'block', marginBottom: '6px' }}>SECTION 0{i + 1}</span>
                {sec.title}
              </h2>
              {sec.questions.map((q) => (
                <Field key={q.id} q={q} value={values[q.id]} error={err[q.id]} set={set(q.id)} />
              ))}
            </section>
          ))}

          {err.form ? (
            <p role="alert" style={{ margin: '0', border: '3px solid var(--err-ink)', padding: '12px 14px', fontSize: '14px', lineHeight: '1.5', color: 'var(--ink)' }}>
              {err.form}
            </p>
          ) : Object.keys(err).length ? (
            <p role="alert" style={{ margin: '0', fontSize: '13.5px', color: 'var(--err-ink)' }}>
              A few answers need another look. They are marked above.
            </p>
          ) : null}
          <button className="ap-cta" type="button" onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '58px', background: '#FF9900', color: '#14161C', fontFamily: 'var(--font-display)', fontSize: '26.3px', border: '0', boxShadow: '5px 5px 0 var(--line)', transition: 'transform .1s steps(2),box-shadow .1s steps(2)', opacity: busy ? '.6' : '1' }}>
            {busy ? 'SENDING…' : 'SEND MY INTEREST >'}
          </button>
          <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>We read every submission and you will hear either way.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'ap-in .4s steps(4) both' }}>
          <span style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'var(--mint-fill)', color: '#14161C', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.18em', textTransform: 'uppercase', padding: '7px 11px' }}>Received</span>
          <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,10vw,57.5px)', lineHeight: '1', color: 'var(--ink)' }}>THANK YOU FOR YOUR INTEREST</h1>
          <div style={{ border: '3px solid var(--line)', background: 'var(--surface)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your reference</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: 'clamp(22px,6.4vw,30px)', letterSpacing: '.04em', color: 'var(--ink)' }}>{sent.ref}</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', borderTop: '1px solid var(--line-soft)', paddingTop: '12px' }}>
              <span style={{ color: 'var(--muted)' }}>Reply goes to</span>
              <span style={{ color: 'var(--ink)', wordBreak: 'break-all', textAlign: 'right' }}>{sent.email}</span>
            </div>
          </div>
          <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', color: 'var(--body)', maxWidth: '56ch' }}>
            Quote this reference in any email. The organising team reviews every submission and will contact shortlisted speakers with the confirmed session, schedule, format and further details.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={() => (setSent(null), setValues({}), setErr({}), setFormKey((k) => k + 1))} style={{ flex: '1 1 180px', minHeight: '52px', padding: '0 18px', border: '3px solid var(--line)', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: '22.5px' }}>
              SEND ANOTHER
            </button>
            <Link href="/" style={{ flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', padding: '0 18px', background: 'var(--ink)', color: 'var(--bg)', fontFamily: 'var(--font-display)', fontSize: '22.5px', textDecoration: 'none' }}>
              BACK HOME
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
