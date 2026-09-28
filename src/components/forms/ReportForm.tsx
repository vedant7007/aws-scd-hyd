'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'
import { REPORT_KINDS } from '@/lib/forms-options'

/**
 * The code of conduct page's #report block from the v3 handoff. It posts to
 * /api/forms: the report is stored, the organisers get a mail they can reply
 * to, and the ticket number shown is the stored one.
 */

const LABEL: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }
const ERR: CSSProperties = { fontSize: '12.5px', color: 'var(--err-ink)', minHeight: '1px' }
const COL: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '7px' }
const ROW: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }
const EMPTY = { email: '', name: '', code: '', detail: '' }

export function ReportForm({ contact }: { contact: string }) {
  const [about, setAbout] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState('')
  const [formKey, setFormKey] = useState(0)
  const honeypot = useRef<HTMLInputElement>(null)
  const top = useRef<HTMLDivElement>(null)

  const on = (k: keyof typeof EMPTY) => (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
    const el = e.currentTarget
    let v = el.value
    // The pass id reads in capitals as it is typed, keeping the caret where it was.
    if (k === 'code' && v !== v.toUpperCase()) {
      const pos = el.selectionStart
      el.value = v = v.toUpperCase()
      if (pos !== null) el.setSelectionRange(pos, pos)
    }
    setForm((p) => ({ ...p, [k]: v }))
    setErr((x) => (k in x ? Object.fromEntries(Object.entries(x).filter(([y]) => y !== k)) : x))
  }

  async function submit() {
    if (busy) return
    const e: Record<string, string> = {}
    if (!about) e.kind = 'Pick what this is about.'
    if (!form.email.trim()) e.email = 'We need an email to reply to.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'That does not look like a working email.'
    if (!form.detail.trim()) e.detail = 'Tell us what happened.'
    else if (form.detail.trim().length < 20) e.detail = 'A bit more detail helps us act on it.'
    if (Object.keys(e).length) {
      setErr(e)
      const first = e.email ? 'coc-email' : e.detail ? 'coc-detail' : null
      if (first) document.getElementById(first)?.focus()
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ form: 'report', about, urgent, email: form.email, name: form.name, passId: form.code, detail: form.detail, company: honeypot.current?.value ?? '' }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; field?: string; message?: string }
      if (res.ok && body.ok && body.ref) {
        setTicket(body.ref)
        setErr({})
        top.current?.scrollIntoView({ block: 'start' })
        return
      }
      setErr({ [body.field ?? 'form']: body.message ?? `Something went wrong on our side. Write to ${contact} instead.` })
    } catch {
      setErr({ form: `Could not reach the server. Check your connection, or write to ${contact}.` })
    } finally {
      setBusy(false)
    }
  }

  const another = () => {
    setTicket('')
    setAbout('')
    setUrgent(false)
    setForm(EMPTY)
    setErr({})
    setFormKey((k) => k + 1)
  }

  const kindShown = REPORT_KINDS.find((k) => k.id === about)?.label ?? ''

  return (
    <div data-dc="1" ref={top} id="report" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '3px solid var(--line)', background: 'var(--panel)', padding: 'clamp(18px,5vw,26px)', scrollMarginTop: '90px' }}>
      {!ticket ? (
        <div key={formKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--violet-ink)' }}>{'// REPORT AN ISSUE'}</span>
            <h2 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,8vw,42.5px)', lineHeight: '1', color: 'var(--ink)' }}>TELL US IN WRITING</h2>
            <p style={{ margin: '0', fontSize: '14.5px', lineHeight: '1.6', color: 'var(--body)', maxWidth: '56ch' }}>You get a ticket number straight away, and a reply to your email. Use this for conduct reports, registration problems, payment issues or anything else.</p>
          </div>
          <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="nt-hp" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span id="coc-kind-l" style={LABEL}>
              What is this about?
            </span>
            <div role="radiogroup" aria-labelledby="coc-kind-l" style={{ display: 'grid', gap: '9px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))' }}>
              {REPORT_KINDS.map((k) => {
                const on = about === k.id
                return (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => (setAbout(k.id), setErr((x) => Object.fromEntries(Object.entries(x).filter(([y]) => y !== 'kind'))))}
                    style={{ minHeight: '50px', padding: '0 12px', fontFamily: 'var(--font-display)', fontSize: '21.3px', border: `3px solid ${on ? '#FF9900' : 'var(--line)'}`, background: on ? '#FF9900' : 'transparent', color: on ? '#14161C' : 'var(--ink)', transition: 'background .12s steps(2),color .12s steps(2)' }}
                  >
                    {k.label}
                  </button>
                )
              })}
            </div>
            <span style={ERR}>{err.kind}</span>
          </div>
          <div style={COL}>
            <label htmlFor="coc-email" style={LABEL}>
              Your email <span style={{ color: 'var(--err-ink)' }}>*</span>
            </label>
            <input id="coc-email" className="inp" defaultValue={form.email} onChange={on('email')} type="email" inputMode="email" autoComplete="email" placeholder="So we can reply to you" aria-invalid={Boolean(err.email)} />
            <span style={ERR}>{err.email}</span>
          </div>
          <div style={COL}>
            <label htmlFor="coc-name" style={LABEL}>
              Your name <span style={{ textTransform: 'none', letterSpacing: '0' }}>(leave blank to stay anonymous to us)</span>
            </label>
            <input id="coc-name" className="inp" defaultValue={form.name} onChange={on('name')} type="text" placeholder="Optional" />
          </div>
          <div style={COL}>
            <label htmlFor="coc-code" style={LABEL}>
              Pass ID <span style={{ textTransform: 'none', letterSpacing: '0' }}>(if you have one)</span>
            </label>
            <input id="coc-code" className="inp" defaultValue={form.code} onChange={on('code')} type="text" autoComplete="off" spellCheck={false} placeholder="SCD-…" style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div style={COL}>
            <label htmlFor="coc-detail" style={LABEL}>
              What happened? <span style={{ color: 'var(--err-ink)' }}>*</span>
            </label>
            <textarea id="coc-detail" className="inp" defaultValue={form.detail} onChange={on('detail')} placeholder="Where, when, who was involved, and what you want us to do about it." aria-invalid={Boolean(err.detail)} style={{ minHeight: '120px', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={ERR}>{err.detail}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', flex: 'none' }}>{form.detail.length} chars</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button type="button" role="checkbox" aria-checked={urgent} onClick={() => setUrgent((u) => !u)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'transparent', border: '0', padding: '4px 0', textAlign: 'left', minHeight: '44px' }}>
              <span aria-hidden="true" style={{ flex: 'none', width: '26px', height: '26px', border: '3px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '21.3px', ...(urgent ? { background: '#FF9900', color: '#14161C' } : { background: 'var(--surface)', color: 'transparent' }) }}>
                x
              </span>
              <span style={{ fontSize: '13.5px', lineHeight: '1.5', color: 'var(--ink)' }}>This is happening right now and needs someone immediately.</span>
            </button>
            {urgent ? (
              <p role="alert" style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: 'var(--err-ink)', border: '3px dashed var(--err-ink)', padding: '12px 14px' }}>
                If you are in danger right now, do not wait for email. Find any volunteer, or call campus security. This form is not monitored second by second.
              </p>
            ) : null}
          </div>
          {err.form ? (
            <p role="alert" style={{ margin: '0', border: '3px solid var(--err-ink)', padding: '12px 14px', fontSize: '14px', lineHeight: '1.5', color: 'var(--ink)' }}>
              {err.form}
            </p>
          ) : null}
          <button className="ap-cta" type="button" onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '56px', padding: '0 24px', background: '#FF9900', color: '#14161C', fontFamily: 'var(--font-display)', fontSize: '25px', border: '0', boxShadow: '5px 5px 0 var(--line)', transition: 'transform .1s steps(2),box-shadow .1s steps(2)', opacity: busy ? '.6' : '1' }}>
            {busy ? 'SENDING…' : urgent ? 'SEND URGENTLY >' : 'SEND REPORT >'}
          </button>
          <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>Only the organising team reads these. Reports are not shown publicly anywhere.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'coc-pop .4s steps(4) both' }}>
          <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '8px', background: '#9FE3B6', color: '#14161C', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.18em', textTransform: 'uppercase', padding: '7px 11px' }}>Logged</span>
          <h2 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,8vw,45px)', lineHeight: '1', color: 'var(--ink)' }}>WE HAVE IT</h2>
          <div style={{ border: '3px solid var(--line)', background: 'var(--surface)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your ticket number</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: 'clamp(22px,6.4vw,30px)', letterSpacing: '.04em', color: 'var(--ink)' }}>{ticket}</span>
            <div style={{ ...ROW, borderTop: '1px solid var(--line-soft)', paddingTop: '11px' }}>
              <span style={{ color: 'var(--muted)' }}>About</span>
              <span style={{ color: 'var(--ink)' }}>{kindShown.charAt(0) + kindShown.slice(1).toLowerCase()}</span>
            </div>
            <div style={ROW}>
              <span style={{ color: 'var(--muted)' }}>Reply goes to</span>
              <span style={{ color: 'var(--ink)', wordBreak: 'break-all', textAlign: 'right' }}>{form.email.trim()}</span>
            </div>
            <div style={ROW}>
              <span style={{ color: 'var(--muted)' }}>Priority</span>
              <span style={{ color: urgent ? 'var(--err-ink)' : 'var(--ink)' }}>{urgent ? 'Urgent' : 'Normal'}</span>
            </div>
          </div>
          <p style={{ margin: '0', fontSize: '14.5px', lineHeight: '1.65', color: 'var(--body)', maxWidth: '56ch' }}>
            Quote <strong style={{ color: 'var(--ink)' }}>{ticket}</strong> in any follow-up email. We reply from {contact}, usually within two days, faster for anything about payments or the event day itself.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={another} style={{ flex: '1 1 180px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', padding: '0 18px', border: '3px solid var(--line)', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: '22.5px' }}>
              REPORT SOMETHING ELSE
            </button>
            <Link href="/" style={{ flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', padding: '0 18px', background: 'var(--ink-fill)', color: 'var(--bg)', fontFamily: 'var(--font-display)', fontSize: '22.5px', textDecoration: 'none' }}>
              BACK HOME
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
