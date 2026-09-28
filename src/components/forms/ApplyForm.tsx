'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SPEAK_FORMATS, SPONSOR_KINDS } from '@/lib/forms-options'

/**
 * The handoff's Speak and Sponsor screens, which are one component with a
 * tab. Its form now posts to /api/forms: the answer is stored, the organisers
 * get a mail they can reply to, and the reference shown is the stored one.
 *
 * Departures: the speaker form's "Which track?" question is gone, because
 * the site has no tracks since v3; there is no meal question, lunch is one
 * kind for everyone; no em dashes; the sponsor intro keeps the
 * site's wording rather than a head count nobody has confirmed.
 */

type Kind = 'speak' | 'sponsor'
type Fields = { org: string; site: string; name: string; role: string; email: string; phone: string; topic: string; detail: string; other: string; offer: string }
const EMPTY: Fields = { org: '', site: '', name: '', role: '', email: '', phone: '', topic: '', detail: '', other: '', offer: '' }

const LABEL: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }
const ERR: CSSProperties = { fontSize: '12.5px', color: 'var(--err-ink)', minHeight: '1px' }
const COL: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '7px' }
const GRID: CSSProperties = { display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))' }
const COUNT: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', flex: 'none' }
const TEXTAREA: CSSProperties = { minHeight: '120px', resize: 'vertical' }
const Req = () => <span style={{ color: 'var(--err-ink)' }}>*</span>

const chip = (on: boolean, fill: string): CSSProperties => ({
  minHeight: '52px', padding: '0 12px', fontFamily: 'var(--font-display)', fontSize: '21.3px',
  border: `3px solid ${on ? fill : 'var(--line)'}`, background: on ? fill : 'transparent', color: on ? 'var(--on-fill)' : 'var(--ink)',
})
const card = (on: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start', textAlign: 'left', padding: '13px 12px', minHeight: '66px',
  border: on ? '4px solid #FF9900' : '3px solid var(--line-soft)', background: on ? 'var(--panel-mint)' : 'var(--surface)', color: 'var(--ink)',
})

const COPY = {
  speak: {
    eyebrow: 'CALL FOR SPEAKERS',
    title: 'APPLY TO SPEAK',
    intro: 'Students and working engineers both. You do not need to be famous, you need something real to say and the willingness to take questions.',
    swap: { href: '/sponsor', label: 'Want to sponsor instead? →' },
    nameLabel: 'Your name',
    roleLabel: 'Role and company or college',
    rolePlaceholder: 'e.g. SDE-1 at Acme, or 3rd year CSE',
    topicLabel: 'Talk title',
    topicPlaceholder: 'What is it called',
    detailLabel: 'What will you cover',
    detailPlaceholder: 'Three or four lines on the content, who it is for, and what they walk away able to do.',
    submit: 'SEND APPLICATION >',
    foot: 'Accepted speakers get one free pass to the day. We read every application and you will hear either way, a no from us is still a reply.',
    doneTitle: 'APPLICATION IN',
    doneBody: 'Quote this reference in any email. Shortlisting happens in batches, and we tell you either way rather than leaving you waiting.',
  },
  sponsor: {
    eyebrow: 'BACK THE DAY',
    title: 'SPONSOR US',
    intro: 'A building full of engineering students for a whole day. Tell us what you want out of it and we will build the package around that.',
    swap: { href: '/speak', label: 'Want to speak instead? →' },
    nameLabel: 'Contact person',
    roleLabel: 'Their role',
    rolePlaceholder: 'e.g. Marketing lead',
    topicLabel: 'Working title for your slot',
    topicPlaceholder: 'Rough is fine, we will shape it with you',
    detailLabel: 'What you want out of the day',
    detailPlaceholder: 'Hiring? Brand awareness? Testing a product with students? Tell us the real goal and roughly what you can commit.',
    submit: 'SEND ENQUIRY >',
    foot: 'One free pass to the day comes with any sponsorship. We reply within two working days, usually the same day, and nothing is committed until you say yes in writing.',
    doneTitle: 'THANK YOU, WE WILL CALL',
    doneBody: 'Quote this reference in any email. We will come back with a package built around what you asked for, stall position, stage slot and pass count included.',
  },
} as const

const GETS = [
  'Your logo on the site',
  'Your logo on the event posters',
  'A shout-out at the start of every session',
  'A shout-out in the mail that goes to every registered attendee',
  'Possibility of a stall inside the college premises, subject to campus approval',
  'Something of yours in every swag kit, tier 1 to tier 4',
]
const HINTS = ['Funds', 'Food or drinks', 'Goodies for kits', 'Prizes', 'Equipment', 'Internships or interviews', 'Cloud credits', 'Travel for speakers']

/** Module level on purpose: defined inside the form, it would remount its input on every keystroke. */
function Field({ id, label, required, children, error }: { id: string; label: ReactNode; required?: boolean; children: ReactNode; error?: string }) {
  return (
    <div style={COL}>
      <label htmlFor={`ap-${id}`} style={LABEL}>
        {label} {required ? <Req /> : null}
      </label>
      {children}
      {required ? <span style={ERR}>{error}</span> : null}
    </div>
  )
}

export function ApplyForm({ kind }: { kind: Kind }) {
  const c = COPY[kind]
  const sponsor = kind === 'sponsor'
  const [f, setF] = useState<Fields>(EMPTY)
  const [format, setFormat] = useState('')
  const [kinds, setKinds] = useState<string[]>([])
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ ref: string; what: string; email: string } | null>(null)
  const [formKey, setFormKey] = useState(0)
  const honeypot = useRef<HTMLInputElement>(null)

  const clear = (k: string) => setErr((e) => (k in e ? Object.fromEntries(Object.entries(e).filter(([x]) => x !== k)) : e))
  const on = (k: keyof Fields) => (e: { currentTarget: { value: string } }) => {
    const v = e.currentTarget.value
    setF((p) => ({ ...p, [k]: v }))
    clear(k)
  }

  const check = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (sponsor && !f.org.trim()) e.org = 'Who is sponsoring?'
    if (!f.name.trim()) e.name = 'We need a name.'
    if (!f.email.trim()) e.email = 'We need an email to reply to.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'That does not look like a working email.'
    if (f.phone.replace(/\D/g, '').length !== 10) e.phone = 'Enter exactly 10 digits, no +91.'
    if (sponsor && !kinds.length) e.kinds = 'Pick at least one.'
    if (sponsor && kinds.includes('other') && !f.other.trim()) e.kinds = 'Tell us what else you want to sponsor.'
    if (sponsor && !f.offer.trim()) e.offer = 'Tell us what you can put in.'
    else if (sponsor && f.offer.trim().length < 25) e.offer = 'A bit more detail, this is what we plan around.'
    if (!sponsor && !format) e.format = 'Pick a format.'
    if (!f.topic.trim()) e.topic = sponsor ? 'Give it a working title.' : 'Your talk needs a title.'
    if (!f.detail.trim()) e.detail = 'Tell us a bit more.'
    else if (f.detail.trim().length < 30) e.detail = 'A few more lines, please, this is what we judge it on.'
    return e
  }

  async function submit() {
    if (busy) return
    const e = check()
    if (Object.keys(e).length) {
      setErr(e)
      const first = ['org', 'name', 'email', 'phone', 'offer', 'topic', 'detail'].find((k) => e[k])
      if (first) document.getElementById(`ap-${first}`)?.focus()
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ form: kind, ...f, format, kinds, company: honeypot.current?.value ?? '' }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; field?: string; message?: string }
      if (res.ok && body.ok && body.ref) {
        const what = sponsor
          ? SPONSOR_KINDS.filter((k) => kinds.includes(k.id)).map((k) => (k.id === 'other' ? f.other.trim().toUpperCase() : k.label)).join(' · ')
          : (SPEAK_FORMATS.find((x) => x.id === format)?.label ?? '')
        setSent({ ref: body.ref, what, email: f.email.trim() })
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

  const again = () => {
    setSent(null)
    setF(EMPTY)
    setFormat('')
    setKinds([])
    setErr({})
    setFormKey((k) => k + 1)
  }

  return (
    <div data-dc="1" style={{ position: 'relative', zIndex: '10', width: '100%', maxWidth: '720px', margin: '0 auto', padding: 'clamp(22px,6vw,44px) clamp(16px,5vw,28px) 80px', display: 'flex', flexDirection: 'column', gap: '22px', boxSizing: 'border-box' }}>
      {!sent ? (
        <div key={formKey} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <Link href={c.swap.href} style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 13px', border: '3px solid var(--line-soft)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            {c.swap.label}
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mint-ink)' }}>
              {'// '}
              {c.eyebrow}
            </span>
            <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,10vw,60px)', lineHeight: '1', color: 'var(--ink)' }}>{c.title}</h1>
            <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', color: 'var(--body)', maxWidth: '56ch' }}>{c.intro}</p>
          </div>

          {sponsor ? (
            <div style={{ border: '4px solid #FF9900', background: 'var(--panel-gold)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--amber-ink)' }}>What you get</span>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))' }}>
                {GETS.map((g) => (
                  <span key={g} style={{ display: 'flex', gap: '9px', fontSize: '14px', lineHeight: '1.5', color: 'var(--body)' }}>
                    <span style={{ color: 'var(--amber-ink)', flex: 'none' }}>▸</span>
                    {g}
                  </span>
                ))}
              </div>
              <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>Exact package depends on what you put in. Tell us below and we will come back with a proper breakdown, not a PDF of tiers.</p>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', border: '3px solid var(--line)', background: 'var(--surface)', padding: 'clamp(18px,5vw,26px)' }}>
            <input ref={honeypot} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="nt-hp" />
            {sponsor ? (
              <>
                <Field id="org" label="Company or organisation" required error={err.org}>
                  <input id="ap-org" className="inp" defaultValue={f.org} onChange={on('org')} type="text" placeholder="Who is sponsoring" aria-invalid={Boolean(err.org)} />
                </Field>
                <Field id="site" label="Website or LinkedIn">
                  <input id="ap-site" className="inp" defaultValue={f.site} onChange={on('site')} type="url" inputMode="url" placeholder="Optional" />
                </Field>
              </>
            ) : null}
            <div style={GRID}>
              <Field id="name" label={c.nameLabel} required error={err.name}>
                <input id="ap-name" className="inp" defaultValue={f.name} onChange={on('name')} type="text" autoComplete="name" placeholder="Full name" aria-invalid={Boolean(err.name)} />
              </Field>
              <Field id="role" label={c.roleLabel}>
                <input id="ap-role" className="inp" defaultValue={f.role} onChange={on('role')} type="text" placeholder={c.rolePlaceholder} />
              </Field>
            </div>
            <div style={GRID}>
              <Field id="email" label="Email" required error={err.email}>
                <input id="ap-email" className="inp" defaultValue={f.email} onChange={on('email')} type="email" inputMode="email" autoComplete="email" placeholder="We reply here" aria-invalid={Boolean(err.email)} />
              </Field>
              <Field id="phone" label="Phone" required error={err.phone}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>
                  <span className="inp-prefix" style={{ fontSize: '14px', padding: '0 12px' }}>
                    +91
                  </span>
                  <input id="ap-phone" className="inp" defaultValue={f.phone} onChange={on('phone')} type="tel" inputMode="numeric" maxLength={10} placeholder="10 digits" aria-invalid={Boolean(err.phone)} />
                </div>
              </Field>
            </div>

            {sponsor ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span id="ap-kinds-l" style={LABEL}>
                    What are you sponsoring? <Req />
                  </span>
                  <div role="group" aria-labelledby="ap-kinds-l" style={{ display: 'grid', gap: '9px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))' }}>
                    {SPONSOR_KINDS.map((k) => {
                      const picked = kinds.includes(k.id)
                      return (
                        <button key={k.id} type="button" aria-pressed={picked} onClick={() => (setKinds((p) => (picked ? p.filter((x) => x !== k.id) : [...p, k.id])), clear('kinds'))} style={chip(picked, 'var(--violet-fill)')}>
                          {k.label}
                        </button>
                      )
                    })}
                  </div>
                  <span style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--muted)' }}>Pick as many as you like, or write your own below.</span>
                  <span style={ERR}>{err.kinds}</span>
                  {kinds.includes('other') ? <input id="ap-other" className="inp" defaultValue={f.other} onChange={on('other')} type="text" placeholder="Tell us what you want to sponsor" aria-label="What else you want to sponsor" /> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', border: '3px dashed var(--line-dash)', padding: '16px 15px' }}>
                  <label htmlFor="ap-offer" style={{ ...LABEL, color: 'var(--violet-ink)' }}>
                    What can you put in? <Req />
                  </label>
                  <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: 'var(--body)' }}>Be specific and be honest, this is the part we actually plan around. Money is only one way to help.</p>
                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                    {HINTS.map((h) => (
                      <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.08em', textTransform: 'uppercase', border: '2px solid var(--line-soft)', color: 'var(--muted)', padding: '5px 8px' }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  <textarea id="ap-offer" className="inp" defaultValue={f.offer} onChange={on('offer')} aria-invalid={Boolean(err.offer)} style={TEXTAREA} placeholder="e.g. Rs 25,000 towards lunch, branded notebooks for every kit, two engineers to run a workshop, and five internship interviews for the top students." />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={ERR}>{err.offer}</span>
                    <span style={COUNT}>{f.offer.length} chars</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span id="ap-format-l" style={LABEL}>
                  What format suits you <Req />
                </span>
                <div role="radiogroup" aria-labelledby="ap-format-l" style={{ display: 'grid', gap: '9px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))' }}>
                  {SPEAK_FORMATS.map((x) => (
                    <button key={x.id} type="button" role="radio" aria-checked={format === x.id} onClick={() => (setFormat(x.id), clear('format'))} style={card(format === x.id)}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '21.3px', color: 'var(--ink)' }}>{x.label}</span>
                      <span style={{ fontSize: '11.5px', lineHeight: '1.4', color: 'var(--muted)', textAlign: 'left' }}>{x.note}</span>
                    </button>
                  ))}
                </div>
                <span style={ERR}>{err.format}</span>
              </div>
            )}

            <Field id="topic" label={c.topicLabel} required error={err.topic}>
              <input id="ap-topic" className="inp" defaultValue={f.topic} onChange={on('topic')} type="text" placeholder={c.topicPlaceholder} aria-invalid={Boolean(err.topic)} />
            </Field>
            <div style={COL}>
              <label htmlFor="ap-detail" style={LABEL}>
                {c.detailLabel} <Req />
              </label>
              <textarea id="ap-detail" className="inp" defaultValue={f.detail} onChange={on('detail')} placeholder={c.detailPlaceholder} aria-invalid={Boolean(err.detail)} style={TEXTAREA} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={ERR}>{err.detail}</span>
                <span style={COUNT}>{f.detail.length} chars</span>
              </div>
            </div>

            {err.form ? (
              <p role="alert" style={{ margin: '0', border: '3px solid var(--err-ink)', padding: '12px 14px', fontSize: '14px', lineHeight: '1.5', color: 'var(--ink)' }}>
                {err.form}
              </p>
            ) : null}
            <button className="ap-cta" type="button" onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '58px', background: '#FF9900', color: 'var(--on-fill)', fontFamily: 'var(--font-display)', fontSize: '26.3px', border: '0', boxShadow: '5px 5px 0 var(--line)', transition: 'transform .1s steps(2),box-shadow .1s steps(2)', opacity: busy ? '.6' : '1' }}>
              {busy ? 'SENDING…' : c.submit}
            </button>
            <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>{c.foot}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'ap-in .4s steps(4) both' }}>
          <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '8px', background: 'var(--mint-fill)', color: '#14161C', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.18em', textTransform: 'uppercase', padding: '7px 11px' }}>Received</span>
          <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,10vw,57.5px)', lineHeight: '1', color: 'var(--ink)' }}>{c.doneTitle}</h1>
          <div style={{ border: '3px solid var(--line)', background: 'var(--surface)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your reference</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: 'clamp(22px,6.4vw,30px)', letterSpacing: '.04em', color: 'var(--ink)' }}>{sent.ref}</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', borderTop: '1px solid var(--line-soft)', paddingTop: '12px' }}>
              <span style={{ color: 'var(--muted)' }}>{sponsor ? 'Sponsoring' : 'Format'}</span>
              <span style={{ color: 'var(--ink)', textAlign: 'right' }}>{sent.what}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: 'var(--muted)' }}>Reply goes to</span>
              <span style={{ color: 'var(--ink)', wordBreak: 'break-all', textAlign: 'right' }}>{sent.email}</span>
            </div>
          </div>
          <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', color: 'var(--body)', maxWidth: '54ch' }}>{c.doneBody}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={again} style={{ flex: '1 1 180px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', padding: '0 18px', border: '3px solid var(--line)', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: '22.5px' }}>
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
