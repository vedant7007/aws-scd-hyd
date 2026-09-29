'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { formatInr, passFor } from '@/content/passes'
import { holdMinutes } from '@/content/payment'
import { EVENT_DAY, MINIMUM_AGE, TIER_LEVEL, YEARS, ageOnEventDay, technicalSessions, workshops, type Level, type Year } from '@/content/program'
import type { Tier } from '@/lib/db/types'

/**
 * The v3 registration flow, ported from the handoff's Registration Flow
 * screen: pick a pass, pick sessions, details, check, pay by UPI, then the
 * "we have your details" page. Styles are the handoff's own, inline, as on
 * the landing.
 *
 * What the handoff faked, this does for real. The hold is made on the
 * server when the student reaches the payment step (it claims their session
 * seats for twenty minutes), the QR is a real UPI link for the exact amount
 * the server decided, the screenshot goes straight to the private bucket
 * through a one-shot URL, and SUBMIT moves the record to verification and
 * sends email 1. The pass id comes from the server.
 *
 * Departures: no em dashes in the copy; "not included" cells use an en dash
 * with a spoken label.
 */

type TierLook = { id: Tier; name: string; metal: string; edge: string; dark: string; light: string; bg: string; holo?: boolean; from: string; adds: string[] }

const TIERS: TierLook[] = [
  { id: 'basic', name: 'REGULAR', metal: 'COPPER', edge: '#6B3417', dark: '#3A1A08', light: '#FFD9BF', bg: 'linear-gradient(135deg,#F7D6BF 0%,#E0A07A 26%,#FADFCB 46%,#C57446 70%,#EDB896 100%)', from: '', adds: ['Keynote + 1 technical session', 'Q&A and Project Expo', 'Lunch', 'Swag kit · tier 1'] },
  { id: 'premium', name: 'PREMIUM', metal: 'GOLD', edge: '#5E3F04', dark: '#3A2600', light: '#FFF0B0', bg: 'linear-gradient(135deg,#FFF2BF 0%,#E8C052 26%,#FFF7D6 46%,#C5921A 70%,#F2D370 100%)', from: 'REGULAR', adds: ['1 hands-on workshop', 'Swag kit · tier 2'] },
  { id: 'ultra', name: 'PLATINUM', metal: 'PLATINUM', edge: '#3E4758', dark: '#1E2533', light: '#DDE6F5', bg: 'linear-gradient(135deg,#F8FAFD 0%,#CBD3DF 26%,#FFFFFF 46%,#A3AFC1 70%,#E4E9F1 100%)', from: 'PREMIUM', adds: ['Panel discussion', 'Reserved seat booking', 'Swag kit · tier 3'] },
  { id: 'vip', name: 'VIP', metal: 'DIAMOND', edge: '#14161C', dark: '#14161C', light: '#F5B5CF', holo: true, bg: 'linear-gradient(115deg,#E8F8FF,#C9B6F5 16%,#F5B5CF 30%,#FFF0B8 44%,#A8EBC4 58%,#A9E3FF 72%,#D9C9FF 86%,#E8F8FF)', from: 'PLATINUM', adds: ['Front-row seating', 'Speaker networking', 'Dedicated assistance', 'Swag kit · tier 4'] },
]

const LEVEL_BG: Record<Level, string> = { Beginner: '#9FE3B6', Intermediate: '#FFB84D', Advanced: '#F2A7C3', 'Beginner–Intermediate': '#A9E3FF' }
const CMP: [string, number][] = [
  ['Lunch', 1],
  ['Opening keynote', 1],
  ['1 technical session', 1],
  ['Q&A session', 1],
  ['Project Expo', 1],
  ['1 hands-on workshop', 2],
  ['Panel discussion', 3],
  ['Reserved seat booking', 3],
  ['Reserved front-row seating', 4],
  ['Speaker networking', 4],
  ['Dedicated VIP assistance', 4],
]
const NAMES = ['', 'Choose a pass', 'Your sessions', 'Your details', 'Check', 'Pay by UPI']
const TITLES = ['', 'PICK YOUR PASS', 'PICK YOUR SESSIONS', 'WHO IS COMING?', 'CHECK IT OVER', 'PAY BY UPI']
const HOLD_MS = holdMinutes * 60_000
const MAX_BYTES = 5 * 1024 * 1024
const CONTACT = 'awssbgvjit@gmail.com'
/** One tab's registration. sessionStorage, not localStorage: a shared lab computer forgets it when the tab closes. */
const STORE = 'scd-registration'

const price = (t: Tier) => passFor(t)?.pricePaise ?? 0
const money = (paise: number) => formatInr(paise)
const EVENT_DAY_LABEL = new Date(`${EVENT_DAY}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

type Fields = { first: string; middle: string; last: string; email: string; phone: string; college: string; branch: string; roll: string; dob: string }
type FieldKey = keyof Fields
const EMPTY: Fields = { first: '', middle: '', last: '', email: '', phone: '', college: '', branch: '', roll: '', dob: '' }
type Upload = { status: 'none' | 'uploading' | 'done' | 'failed'; name: string; url: string; pct: number; err: string; key: string }
const NO_UPLOAD: Upload = { status: 'none', name: '', url: '', pct: 0, err: '', key: '' }
/** holdEnds 0 means no clock: a rejected record being resubmitted keeps its seats with no deadline. */
export type Hold = { passId: string; holdEnds: number; amountPaise: number; payee: string | null; link: string | null }

/**
 * The payment step on its own, for the link in the rejection email and for
 * anyone who lost the tab mid-payment. No way back to the earlier steps:
 * those belong to the browser that made the hold.
 */
export type Resume = {
  hold: Hold
  tier: Tier
  tech: string
  workshop: string
  first: string
  email: string
  rejection: string | null
}

type Saved = {
  step: number
  phase: 'form' | 'review'
  tier: Tier | null
  tech: string
  workshop: string
  year: Year | ''
  fields: Fields
  hold: Hold | null
  utr: string
  submissionKey: string
}

const newKey = () => {
  const b = new Uint8Array(18)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/* ---- the handoff's repeated styles ------------------------------------------ */

const S = {
  eye: { fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--mint-ink)', whiteSpace: 'nowrap' },
  eyeR: { fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' },
  label: { fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' },
  err: { fontSize: '12.5px', color: 'var(--err-ink)', minHeight: '1px' },
  hint: { fontSize: '12px', color: 'var(--muted)' },
  field: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: '0' },
  small: { minHeight: '40px', background: 'transparent', border: '2px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', padding: '0 10px' },
  rowL: { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' },
  headRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  col: { display: 'flex', flexDirection: 'column', gap: '10px' },
} satisfies Record<string, CSSProperties>

const optStyle = (on: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start', width: '100%', minHeight: '96px', padding: '14px', cursor: 'pointer', textAlign: 'left', transition: 'transform .1s steps(2)',
  background: on ? 'var(--panel-mint)' : 'var(--surface)', border: on ? '4px solid #FF9900' : '3px solid var(--line)', boxShadow: on ? '5px 5px 0 var(--line)' : 'none',
})
const radioDot = (on: boolean): CSSProperties => ({ flex: 'none', width: '18px', height: '18px', border: '3px solid var(--line)', boxSizing: 'border-box', background: on ? '#FF9900' : 'transparent', boxShadow: `inset 0 0 0 3px ${on ? 'var(--surface)' : 'transparent'}` })
const levelChip = (l: Level): CSSProperties => ({ fontFamily: 'var(--font-mono)', fontSize: '9.5px', fontWeight: 600, letterSpacing: '.16em', color: '#14161C', padding: '3px 7px', border: '2px solid #14161C', background: LEVEL_BG[l] })
const chip = (on: boolean, display = false): CSSProperties => ({
  minHeight: '48px', padding: '0 6px', border: `3px solid ${on ? '#FF9900' : 'var(--line)'}`, background: on ? '#FF9900' : 'var(--surface)', color: on ? '#14161C' : 'var(--ink)',
  ...(display ? { fontFamily: 'var(--font-display)', fontSize: '19px' } : { fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '16px' }),
})

/* ---- the component ------------------------------------------------------- */

export function Flow({ preview, resume }: { preview: boolean; resume?: Resume }) {
  const router = useRouter()
  const [step, setStep] = useState(resume ? 5 : 1)
  const [phase, setPhase] = useState<'form' | 'review'>('form')
  const [tier, setTier] = useState<Tier | null>(resume?.tier ?? null)
  const [tech, setTech] = useState(resume?.tech ?? '')
  const [workshop, setWorkshop] = useState(resume?.workshop ?? '')
  const [year, setYear] = useState<Year | ''>('')
  const [fields, setFields] = useState<Fields>(resume ? { ...EMPTY, first: resume.first, email: resume.email } : EMPTY)
  const [err, setErr] = useState<Record<string, string>>({})
  const [hold, setHold] = useState<Hold | null>(resume?.hold ?? null)
  const [now, setNow] = useState(() => Date.now())
  const [utr, setUtr] = useState('')
  const [utrTouched, setUtrTouched] = useState(false)
  const [up, setUp] = useState<Upload>(NO_UPLOAD)
  const [copied, setCopied] = useState<'' | 'id'>('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [formKey, setFormKey] = useState(0)
  const key = useRef('')
  // State, not a ref: the first save must wait for the render that carries
  // the restored draft, or it writes the empty form over it.
  const [loaded, setLoaded] = useState(false)
  const xhr = useRef<XMLHttpRequest | null>(null)

  // Restore this tab's registration, so a refresh or going back never loses it.
  // A resumed payment is not this tab's draft and is never saved over it.
  useEffect(() => {
    if (resume) return
    try {
      const s = JSON.parse(sessionStorage.getItem(STORE) ?? 'null') as Saved | null
      if (s) {
        // Storage only exists after hydration, so this cannot be initial state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep(s.step)
        setPhase(s.phase === 'review' ? 'review' : 'form')
        setTier(s.tier)
        setTech(s.tech)
        setWorkshop(s.workshop)
        setYear(s.year)
        setFields({ ...EMPTY, ...s.fields })
        setHold(s.hold)
        setUtr(s.utr)
        key.current = s.submissionKey
        setFormKey((k) => k + 1)
      }
    } catch {
      // Storage blocked or garbled: start clean.
    }
    if (!key.current) key.current = newKey()
    setLoaded(true)
  }, [resume])

  useEffect(() => {
    if (!loaded) return
    const s: Saved = { step, phase, tier, tech, workshop, year, fields, hold, utr, submissionKey: key.current }
    try {
      sessionStorage.setItem(STORE, JSON.stringify(s))
    } catch {
      // Private window with storage off: the flow still works, it just forgets on refresh.
    }
  }, [loaded, step, phase, tier, tech, workshop, year, fields, hold, utr])

  // The hold clock. Only the payment step counts down.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const lvl = tier ? TIER_LEVEL[tier] : 1
  const t = TIERS.find((x) => x.id === tier) ?? null
  const amount = hold?.amountPaise ?? (tier ? price(tier) : 0)
  const age = fields.dob ? ageOnEventDay(fields.dob) : null
  const underage = age !== null && age < MINIMUM_AGE
  const top = () => window.scrollTo(0, 0)

  /* ---- step 3 validation, the handoff's messages ---- */
  const validate = (): Record<string, string> => {
    const f = fields
    const e: Record<string, string> = {}
    if (!f.first.trim()) e.first = 'We need your first name.'
    if (!f.last.trim()) e.last = 'We need your last name.'
    if (!f.branch.trim()) e.branch = 'Which branch are you in?'
    if (!f.roll.trim()) e.roll = 'We need your roll number.'
    else if (f.roll.trim().length < 4) e.roll = 'That roll number looks too short.'
    if (!f.dob) e.dob = 'We need your date of birth.'
    else if (age === null) e.dob = 'That date does not look right.'
    else if (age < MINIMUM_AGE) e.dob = 'Under 18 on the event day.'
    if (!f.email.trim()) e.email = 'We need an email for your pass.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'That does not look like a working email.'
    const d = f.phone.replace(/\D/g, '')
    if (!d) e.phone = 'We need a phone number.'
    else if (d.length !== 10) e.phone = 'Enter exactly 10 digits, without +91.'
    if (!f.college.trim()) e.college = 'Which college are you from?'
    if (!year) e.year = 'Pick your year.'
    return e
  }

  /* ---- the UTR, the handoff's rules ---- */
  const utrCompact = utr.replace(/\s/g, '')
  const utrState = (): { ok: boolean; bad?: boolean; msg: string } => {
    if (!utrCompact) return { ok: false, bad: Boolean(err.utr), msg: err.utr ?? '' }
    if (/[^0-9A-Z]/.test(utrCompact)) return { ok: false, bad: true, msg: 'Only letters and numbers. Check you copied the reference number.' }
    if (utrCompact.length < 12) {
      return { ok: false, bad: utrTouched, msg: utrTouched ? `That looks too short. A UTR is at least 12 characters. You have entered ${utrCompact.length}.` : `${utrCompact.length} characters so far` }
    }
    if (err.utr) return { ok: false, bad: true, msg: err.utr }
    return { ok: true, msg: `✓ ${utrCompact.length} characters. Looks right.` }
  }
  const u = utrState()

  /* ---- actions ---- */

  const pickTier = (id: Tier) => {
    setTier(id)
    setErr({})
    if (TIER_LEVEL[id] < 2) setWorkshop('')
  }
  const clearErr = (k: string) =>
    setErr((e) => {
      if (!(k in e)) return e
      const n = { ...e }
      delete n[k]
      return n
    })
  const onField = (k: FieldKey, v: string) => {
    setFields((f) => ({ ...f, [k]: v }))
    clearErr(k)
  }

  /** Server field names to the flow's steps, for a refusal the browser did not catch. */
  const STEP_OF: Record<string, number> = { tier: 1, tech: 2, workshop: 2, first: 3, middle: 3, last: 3, email: 3, phone: 3, college: 3, branch: 3, roll: 3, year: 3, dob: 3 }

  async function placeHold(): Promise<void> {
    if (!tier) return
    setBusy(true)
    setNotice('')
    try {
      const res = await fetch(`/api/registrations/hold${preview ? '?preview=1' : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tier,
          technicalSession: tech,
          ...(lvl >= 2 ? { workshop } : {}),
          firstName: fields.first,
          middleName: fields.middle,
          lastName: fields.last,
          email: fields.email,
          phone: fields.phone,
          college: fields.college,
          branch: fields.branch,
          rollNumber: fields.roll.toUpperCase(),
          yearOfStudy: year,
          dateOfBirth: fields.dob,
          submissionKey: key.current,
          ...(hold ? { passId: hold.passId } : {}),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        field?: string
        message?: string
        passId?: string
        amountPaise?: number
        holdUntil?: string
        upi?: { payee: string | null; link: string | null }
      }
      if (res.ok && body.ok && body.passId && body.holdUntil && body.upi) {
        setHold({ passId: body.passId, holdEnds: Date.parse(body.holdUntil), amountPaise: body.amountPaise ?? amount, payee: body.upi.payee, link: body.upi.link })
        setNow(Date.now())
        setErr({})
        setStep(5)
        top()
        return
      }
      const field = body.field && STEP_OF[body.field] ? body.field : ''
      const message = body.message ?? 'Something went wrong on our side. Nothing was charged. Try again.'
      if (field) {
        setErr({ [field]: message })
        setStep(STEP_OF[field]!)
        top()
      } else setNotice(message)
    } catch {
      setNotice('Could not reach the server. Check your connection and try again. Nothing was charged.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(): Promise<void> {
    if (!hold) return
    setBusy(true)
    setNotice('')
    try {
      const res = await fetch('/api/registrations/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passId: hold.passId, utr: utrCompact, screenshotKey: up.key }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; field?: string; message?: string }
      if (res.ok && body.ok) {
        setPhase('review')
        top()
        return
      }
      const message = body.message ?? 'Something went wrong on our side. Try again.'
      if (body.field === 'utr' || body.field === 'shot') setErr({ [body.field]: message })
      else setNotice(message)
    } catch {
      setNotice('Could not reach the server. Your UTR and screenshot are still here. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File): Promise<void> {
    if (!hold) return
    const fail = (e: string) => setUp({ ...NO_UPLOAD, status: 'failed', name: file.name, err: e })
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return fail('That file type did not work. Use a JPG or PNG under 5 MB.')
    if (file.size > MAX_BYTES) return fail('That image is over 5 MB. Crop it or send a normal screenshot instead.')
    clearErr('shot')
    xhr.current?.abort()
    const url = URL.createObjectURL(file)
    setUp({ status: 'uploading', name: file.name, url, pct: 4, err: '', key: '' })
    try {
      const res = await fetch('/api/registrations/screenshot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passId: hold.passId, contentType: file.type, bytes: file.size }),
      })
      const grant = (await res.json().catch(() => ({}))) as { ok?: boolean; key?: string; url?: string; headers?: Record<string, string>; message?: string }
      if (!res.ok || !grant.url || !grant.key) return fail(grant.message ?? 'The upload could not start. Try again.')
      const req = new XMLHttpRequest()
      xhr.current = req
      req.open('PUT', grant.url)
      for (const [k, v] of Object.entries(grant.headers ?? {})) req.setRequestHeader(k, v)
      req.upload.onprogress = (e) => {
        if (e.lengthComputable) setUp((p) => ({ ...p, pct: Math.max(4, (e.loaded / e.total) * 100) }))
      }
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) setUp({ status: 'done', name: file.name, url, pct: 100, err: '', key: grant.key! })
        else fail('The upload did not go through. Your UTR is still here. Try the screenshot again.')
      }
      req.onerror = () => fail('The connection dropped halfway. Your UTR is still here. Try the screenshot again.')
      req.send(file)
    } catch {
      fail('The connection dropped halfway. Your UTR is still here. Try the screenshot again.')
    }
  }

  const goBack = () => {
    top()
    setErr({})
    setNotice('')
    setStep((s) => Math.max(1, s - 1))
  }

  const goNext = () => {
    if (busy) return
    if (step === 1) {
      if (!tier) return setErr({ tier: 'Pick a pass to continue.' })
      top()
      setErr({})
      return setStep(2)
    }
    if (step === 2) {
      const e: Record<string, string> = {}
      if (!tech) e.tech = 'Choose the technical session you want to attend.'
      if (lvl >= 2 && !workshop) e.workshop = 'Choose the hands-on workshop you want to attend.'
      if (Object.keys(e).length) return setErr(e)
      top()
      setErr({})
      return setStep(3)
    }
    if (step === 3) {
      if (underage) return
      const e = validate()
      if (Object.keys(e).length) {
        setErr(e)
        const first = (['first', 'last', 'email', 'phone', 'college', 'branch', 'roll', 'dob'] as const).find((k) => e[k])
        if (first) document.getElementById(`rg-${first}`)?.focus()
        return
      }
      top()
      setErr({})
      return setStep(4)
    }
    // Every visit to the payment step goes through the server: the first
    // makes the hold, a later one after an edit moves it and keeps the clock.
    if (step === 4) return void placeHold()

    const e: Record<string, string> = {}
    if (!utrCompact) e.utr = 'Enter the UTR from your UPI app.'
    if (up.status !== 'done') e.shot = up.status === 'uploading' ? 'Wait for the screenshot to finish uploading.' : 'Add the screenshot of your UPI receipt.'
    if (!u.ok || Object.keys(e).length) {
      setUtrTouched(true)
      setErr(e)
      if (!u.ok) document.getElementById('rg-utr')?.focus()
      return
    }
    void submit()
  }

  const restart = () => {
    // A resumed payment has no earlier steps here; the full flow starts over.
    if (resume) return router.push('/register')
    top()
    setPhase('form')
    setStep(4)
    setUtr('')
    setUtrTouched(false)
    setUp(NO_UPLOAD)
    setNotice('')
  }

  const copy = (text: string, what: 'id') => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(what)
  }

  /* ---- derived for render ---- */

  // Expiry is read off the clock, not stored: a refresh after the hold lapses lands here too.
  const expired = phase === 'form' && step === 5 && Boolean(hold?.holdEnds) && now >= hold!.holdEnds
  const inForm = phase === 'form' && !expired
  const left = hold ? Math.max(0, hold.holdEnds - now) : HOLD_MS
  const clocked = Boolean(hold?.holdEnds)
  const urgent = clocked && left < 5 * 60_000
  const clock = `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`
  const ready = u.ok && up.status === 'done'
  const techName = technicalSessions.find((o) => o.id === tech)?.title ?? ''
  const wsName = workshops.find((o) => o.id === workshop)?.title ?? ''
  const fullName = [fields.first, fields.middle, fields.last].map((x) => x.trim()).filter(Boolean).join(' ')
  const missing = step === 3 ? Object.keys(validate()).length : 0
  const sessLeft = (tech ? 0 : 1) + (lvl >= 2 && !workshop ? 1 : 0)
  const bar = (n: number) => (step > n ? '#9FE3B6' : step === n ? '#FF9900' : 'var(--bar)')

  const barLabel =
    step === 1 ? (t ? t.name : 'No pass picked')
    : step === 2 ? (sessLeft ? `${sessLeft} still to pick` : 'Sessions set')
    : step === 3 ? (underage ? 'Under 18 · blocked' : missing ? `${missing} still to fill` : 'All done')
    : step === 4 ? 'Amount to send'
    : ready ? 'Ready to submit' : !clocked ? 'Amount paid' : urgent ? 'Hold ends in' : 'Place held for'
  const barValue = step === 5 ? (ready || !clocked ? money(amount) : urgent ? clock : `${Math.ceil(left / 60_000)} MIN`) : t ? money(amount) : '-'
  const nextLabel = busy ? 'WAIT…' : step === 4 ? 'GO TO PAYMENT >' : step === 5 ? 'SUBMIT >' : 'CONTINUE >'
  const nextDisabled = busy || (step === 3 && underage)

  const reviewRows = [
    { label: 'Technical', value: techName },
    ...(lvl >= 2 ? [{ label: 'Workshop', value: wsName }] : []),
    { label: 'Name', value: fullName },
    { label: 'Email', value: fields.email },
    { label: 'Phone', value: fields.phone ? `+91 ${fields.phone.replace(/\D/g, '')}` : '' },
    { label: 'College', value: fields.college },
    { label: 'Branch', value: fields.branch },
    { label: 'Roll number', value: fields.roll.toUpperCase() },
    { label: 'Year', value: year ? `Year ${year}` : '' },
    { label: 'Date of birth', value: fields.dob ? new Date(`${fields.dob}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '' },
  ]

  return (
    <div data-dc="1" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'fixed', inset: '0', zIndex: '0', pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)', backgroundSize: '34px 34px' }} />

      <header style={{ position: 'sticky', top: '0', zIndex: '20', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px clamp(16px,5vw,40px)', background: 'var(--surface)', borderBottom: '3px solid var(--line)' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display)', letterSpacing: '.02em', fontSize: 'clamp(21px,5.4vw,26px)', color: 'var(--ink)' }}>
          {'< SCD'}
          <span style={{ color: '#FF9900' }}>.</span>HYD 26
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle />
        </div>
      </header>

      <div aria-hidden="true" style={{ position: 'relative', zIndex: '15', overflow: 'hidden', background: '#14161C', borderBottom: '3px solid var(--line)' }}>
        <div style={{ display: 'flex', width: 'max-content', fontFamily: 'var(--font-mono)', fontSize: '11.5px', letterSpacing: '.2em', color: '#FF9900', padding: '9px 0', animation: 'rg-march 28s linear infinite' }}>
          <Ticker />
          <Ticker />
        </div>
      </div>

      <main style={{ position: 'relative', zIndex: '10', flex: '1', width: '100%', maxWidth: '1120px', margin: '0 auto', padding: 'clamp(24px,6vh,56px) clamp(16px,5vw,48px) 150px', display: 'flex', flexDirection: 'column', gap: 'clamp(18px,4vh,26px)' }}>
        {inForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ flex: '1', height: '8px', background: bar(n) }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ ...S.eye, letterSpacing: '.2em' }}>STEP 0{step} OF 05</span>
              <span style={{ ...S.eyeR, letterSpacing: '.14em' }}>{NAMES[step]}</span>
            </div>
            <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(44px,9vw,84px)', lineHeight: '.92', letterSpacing: '.01em', color: 'var(--ink)', textShadow: '4px 4px 0 var(--h-sh)' }}>{TITLES[step]}</h1>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(20px,3vw,40px)', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 440px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: 'clamp(18px,4vh,26px)' }}>
            {inForm && step === 1 ? <StepPass tier={tier} pickTier={pickTier} err={err.tier} /> : null}

            {inForm && step === 2 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.6', color: 'var(--body)', maxWidth: '56ch' }}>Some sessions come with every pass and are already on your plan. Where there is a choice, pick one.</p>
                <p role="note" style={{ margin: '0', alignSelf: 'flex-start', border: '3px dashed var(--line-dash)', padding: '10px 14px', fontSize: '13px', lineHeight: '1.55', color: 'var(--body)' }}>
                  <strong style={{ color: 'var(--ink)' }}>Sessions are subject to change.</strong> Titles, speakers and timings may shift before the day. If yours changes, we will email you.
                </p>
                <div style={S.col}>
                  <span style={S.eye}>{'// 01 · KEYNOTE'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', border: '3px solid var(--line)', background: 'var(--surface)', padding: '14px 16px' }}>
                    <span aria-hidden="true" style={{ flex: 'none', width: '26px', height: '26px', border: '3px solid var(--line)', background: '#9FE3B6', color: '#14161C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '20px' }}>✓</span>
                    <span style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '25px', lineHeight: '1', color: 'var(--ink)' }}>OPENING KEYNOTE</span>
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Everyone attends. Already on your plan.</span>
                    </span>
                    <span style={{ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '.16em', background: 'var(--ink-fill)', color: 'var(--bg)', padding: '4px 8px' }}>■ INCLUDED</span>
                  </div>
                </div>

                <div style={S.col}>
                  <div style={S.headRow}>
                    <span id="rg-tech-l" style={S.eye}>{'// 02 · TECHNICAL SESSION'}</span>
                    <span style={S.eyeR}>You can attend one</span>
                  </div>
                  <div role="radiogroup" aria-labelledby="rg-tech-l" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,230px),1fr))', gap: '12px' }}>
                    {technicalSessions.map((o) => (
                      <Option key={o.id} code={o.code} level={o.level} title={o.title} on={tech === o.id} onPick={() => (setTech(o.id), clearErr('tech'))} />
                    ))}
                  </div>
                  <span role="alert" style={S.err}>{err.tech}</span>
                </div>

                <div style={S.col}>
                  <div style={S.headRow}>
                    <span id="rg-ws-l" style={S.eye}>{'// 03 · HANDS-ON WORKSHOP'}</span>
                    <span style={S.eyeR}>{lvl >= 2 ? 'You can attend one' : 'Premium and above'}</span>
                  </div>
                  {lvl >= 2 ? (
                    <>
                      <div role="radiogroup" aria-labelledby="rg-ws-l" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px' }}>
                        {workshops.map((o) => (
                          <Option key={o.id} code={o.code} level={o.level} title={o.title} on={workshop === o.id} onPick={() => (setWorkshop(o.id), clearErr('workshop'))} />
                        ))}
                      </div>
                      <span role="alert" style={S.err}>{err.workshop}</span>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', border: '3px dashed var(--line-dash)', padding: '14px 16px', background: 'repeating-linear-gradient(45deg,transparent 0 8px,var(--slot) 8px 16px)' }}>
                      <span style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '23px', lineHeight: '1', color: 'var(--muted)' }}>NOT ON REGULAR</span>
                        <span style={{ fontSize: '13px', color: 'var(--body)' }}>Workshops come with Premium and above.</span>
                      </span>
                      <button type="button" onClick={() => pickTier('premium')} style={{ flex: 'none', minHeight: '44px', padding: '0 14px', background: '#E8C052', color: '#14161C', border: '3px solid #5E3F04', fontFamily: 'var(--font-display)', fontSize: '20px', cursor: 'pointer' }}>
                        UPGRADE TO PREMIUM · +{money(price('premium') - price('basic'))}
                      </button>
                    </div>
                  )}
                </div>

                <div style={S.col}>
                  <span style={S.eye}>{'// ALSO ON YOUR PASS'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', border: '3px solid var(--line)', background: 'var(--surface)' }}>
                    <Extra lvl={lvl} pickTier={pickTier} name="Q&A SESSION" note="Everyone attends." need={1} />
                    <Extra lvl={lvl} pickTier={pickTier} name="PROJECT EXPO" note="Walk through student projects all day. Everyone gets in." need={1} />
                    <Extra lvl={lvl} pickTier={pickTier} name="PANEL DISCUSSION" note="Already on your plan." need={3} up="ultra" upName="Platinum" />
                    <Extra lvl={lvl} pickTier={pickTier} name="RESERVED SEAT" note="A seat booked for you in your sessions." need={3} up="ultra" upName="Platinum" />
                    <Extra lvl={lvl} pickTier={pickTier} name="FRONT-ROW SEATING" note="Reserved for you." need={4} up="vip" upName="VIP" />
                    <Extra lvl={lvl} pickTier={pickTier} name="SPEAKER NETWORKING" note="Time with the speakers." need={4} up="vip" upName="VIP" />
                    <Extra lvl={lvl} pickTier={pickTier} name="DEDICATED ASSISTANCE" note="A volunteer looks after you on the day." need={4} up="vip" upName="VIP" />
                  </div>
                </div>
              </div>
            ) : null}

            {inForm && step === 3 ? (
              <div key={formKey} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <p style={{ margin: '0', flex: '1 1 auto', fontSize: '13px', lineHeight: '1.55', color: 'var(--muted)' }}>Middle name is optional. Everything else is needed.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,170px),1fr))', gap: '12px' }}>
                    <Field id="first" label="First name" value={fields.first} onChange={onField} err={err.first} autoComplete="given-name" />
                    <Field id="middle" label="Middle name · optional" value={fields.middle} onChange={onField} err={err.middle} autoComplete="off" />
                    <Field id="last" label="Last name" value={fields.last} onChange={onField} err={err.last} autoComplete="family-name" />
                  </div>
                  <span style={S.hint}>As on your college ID. Printed on your ticket.</span>
                </div>
                <Field id="email" label="Email" type="email" inputMode="email" value={fields.email} onChange={onField} err={err.email} autoComplete="email" placeholder="you@example.com">
                  <span style={S.hint}>Every update about your pass goes here. Check it twice.</span>
                </Field>
                <div style={S.field}>
                  <label htmlFor="rg-phone" style={S.label}>Phone</label>
                  <div style={{ display: 'flex' }}>
                    <span className="inp-prefix">+91</span>
                    <input id="rg-phone" className="inp" defaultValue={fields.phone} onChange={(e) => onField('phone', e.currentTarget.value)} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10 digits" aria-invalid={Boolean(err.phone)} aria-describedby="rg-phone-e" style={{ fontFamily: 'var(--font-mono)' }} />
                  </div>
                  <span id="rg-phone-e" style={S.err}>{err.phone}</span>
                </div>
                <Field id="college" label="College" value={fields.college} onChange={onField} err={err.college} autoComplete="organization" placeholder="Any college in Hyderabad" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px' }}>
                  <Field id="branch" label="Branch" value={fields.branch} onChange={onField} err={err.branch} placeholder="e.g. CSE, ECE, IT" />
                  <Field id="roll" label="Roll number" value={fields.roll} onChange={onField} err={err.roll} autoComplete="off" placeholder="As on your college ID" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span id="rg-year-l" style={S.label}>Year of study</span>
                  <div role="group" aria-labelledby="rg-year-l" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: '6px' }}>
                    {YEARS.map((y) => (
                      <button key={y} type="button" onClick={() => (setYear(y), clearErr('year'))} aria-pressed={year === y} style={chip(year === y)}>
                        {y}
                      </button>
                    ))}
                  </div>
                  <span role="alert" style={S.err}>{err.year}</span>
                </div>
                <Field id="dob" label="Date of birth" type="date" value={fields.dob} onChange={onField} err={err.dob} autoComplete="bday" min="1960-01-01" max="2012-12-31" style={{ fontFamily: 'var(--font-mono)' }} wrapStyle={{ maxWidth: '280px' }}>
                  <span style={S.hint}>You need to be 18 or over on {EVENT_DAY_LABEL}.</span>
                </Field>
                {underage ? (
                  <div role="alert" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', border: '4px solid var(--err-ink)', background: 'var(--surface)', padding: '16px', boxShadow: '6px 6px 0 var(--sh)' }}>
                    <span aria-hidden="true" style={{ flex: 'none', width: '34px', height: '34px', background: 'var(--err-ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '26px' }}>✕</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '26px', lineHeight: '1', color: 'var(--err-ink)' }}>REGISTRATION BLOCKED</span>
                      <span style={{ fontSize: '14px', lineHeight: '1.55', color: 'var(--ink)' }}>
                        You will be {age} on {EVENT_DAY_LABEL}. This event is for people aged {MINIMUM_AGE} and over, so we cannot take your registration.
                      </span>
                      <span style={{ fontSize: '12.5px', lineHeight: '1.5', color: 'var(--muted)' }}>Typed the wrong date? Fix it above and you can carry on.</span>
                    </span>
                  </div>
                ) : null}
                <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>
                  By continuing you agree to the <Link href="/code-of-conduct">code of conduct</Link>.
                </p>
              </div>
            ) : null}

            {inForm && step === 4 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: '3px solid var(--line)', background: 'var(--surface)', boxShadow: '6px 6px 0 var(--sh)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', borderBottom: '3px solid var(--line)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--ink)' }}>{t?.name}</span>
                    <span style={{ display: 'flex', gap: '7px' }}>
                      <button type="button" onClick={() => (top(), setStep(3))} style={S.small}>
                        Details
                      </button>
                      <button type="button" onClick={() => (top(), setStep(1))} style={S.small}>
                        Tier
                      </button>
                    </span>
                  </div>
                  {reviewRows.map((r) => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '11px 16px', borderBottom: '1px solid var(--line-soft)' }}>
                      <span style={{ ...S.rowL, flex: 'none' }}>{r.label}</span>
                      <span style={{ fontSize: '14px', lineHeight: '1.45', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-word' }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', flexWrap: 'wrap' }}>
                    <span style={S.rowL}>Amount to send</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '26px', color: 'var(--ink)' }}>{money(amount)}</span>
                  </div>
                </div>
                <div style={{ border: '3px dashed var(--line-dash)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ ...S.rowL, letterSpacing: '.16em', color: 'var(--mint-ink)' }}>What happens next</span>
                  <p style={{ margin: '0', fontSize: '13.5px', lineHeight: '1.6', color: 'var(--body)' }}>
                    You get a UPI QR for the college account. Pay in your own UPI app, then come back and enter the UTR number and a screenshot. <strong style={{ color: 'var(--ink)' }}>Your place is held for {holdMinutes} minutes</strong> from the next screen.
                  </p>
                </div>
                <Notice text={notice} />
              </div>
            ) : null}

            {inForm && step === 5 && hold ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {resume?.rejection ? (
                  <div role="status" style={{ border: '3px solid var(--err-ink)', background: 'var(--surface)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ ...S.rowL, color: 'var(--err-ink)' }}>We could not match your last payment</span>
                    <span style={{ fontSize: '14px', lineHeight: '1.55', color: 'var(--ink)' }}>{resume.rejection}</span>
                    <span style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--body)' }}>If you already paid, do not pay again: enter the right UTR and a screenshot of that payment below. Your seats are still held.</span>
                  </div>
                ) : null}
                {!clocked ? null : !urgent ? (
                  <div style={{ border: '3px solid var(--line)', background: 'var(--panel-mint)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', color: 'var(--ink)' }}>Your place is held. No rush.</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink)' }}>
                        <strong>{Math.max(1, Math.ceil(left / 60_000))}</strong> min left
                      </span>
                    </div>
                    <span style={{ height: '8px', background: 'var(--surface)', border: '2px solid var(--line)', display: 'block' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.round((left / HOLD_MS) * 100)}%`, background: '#9FE3B6' }} />
                    </span>
                  </div>
                ) : (
                  <div role="status" style={{ border: '3px solid var(--line)', background: '#FF9900', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '4px 4px 0 var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#14161C' }}>Under 5 minutes left on your hold</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: '600', color: '#14161C' }}>{clock}</span>
                    </div>
                    <span style={{ fontSize: '13px', lineHeight: '1.5', color: '#14161C' }}>Already paid? Enter the UTR and add the screenshot now and you are fine. Once you submit, the clock stops.</span>
                  </div>
                )}

                <div style={{ position: 'relative', border: '3px solid var(--line)', background: 'var(--panel)', boxShadow: '6px 6px 0 var(--sh)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', background: 'var(--ink-fill)', color: 'var(--bg)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: '1' }}>STEP 1 · SCAN AND PAY</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.14em' }}>ANY UPI APP</span>
                  </div>
                  <div style={{ position: 'relative', padding: '34px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', backgroundImage: 'linear-gradient(var(--line-soft) 1px,transparent 1px),linear-gradient(90deg,var(--line-soft) 1px,transparent 1px)', backgroundSize: '18px 18px', backgroundPosition: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                      <span style={{ display: 'flex', background: '#FFFFFF', padding: '12px', border: '4px solid #14161C', boxShadow: '6px 6px 0 #14161C' }}>
                        {hold.link ? (
                          <QRCodeSVG value={hold.link} size={248} level="M" marginSize={0} role="img" aria-label={`UPI payment QR code for ${money(amount)}`} style={{ display: 'block', width: 'min(56vw,208px)', height: 'min(56vw,208px)' }} />
                        ) : (
                          <span role="img" aria-label="No UPI QR yet" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: 'min(56vw,208px)', height: 'min(56vw,208px)', background: 'repeating-linear-gradient(45deg,#FFFFFF 0 8px,#F1EEE9 8px 16px)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.1em', color: '#14161C', padding: '0 12px', boxSizing: 'border-box' }}>
                            PAYMENT QR NOT SET YET. IT APPEARS HERE ONCE IT IS.
                          </span>
                        )}
                      </span>
                      <Coin />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink)', background: 'var(--surface)', padding: '2px 6px' }}>Pay exactly</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '40px', lineHeight: '1', color: '#14161C', background: '#FF9900', border: '3px solid #14161C', padding: '6px 16px', boxShadow: '4px 4px 0 #14161C' }}>{money(amount)}</span>
                      <span style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--ink)', background: 'var(--surface)', padding: '4px 8px', maxWidth: '34ch' }}>Type this amount in your UPI app after scanning. Not rounded: a different amount cannot be matched to you.</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface)', borderTop: '3px solid var(--line)', padding: '6px 14px 10px', display: 'flex', flexDirection: 'column' }}>
                    {hold.payee ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: '1px solid var(--line-soft)', fontSize: '13px' }}>
                        <span style={S.rowL}>Payee</span>
                        <span style={{ textAlign: 'right', color: 'var(--ink)' }}>{hold.payee}</span>
                      </div>
                    ) : null}
                    <span style={{ paddingTop: '8px', fontSize: '12.5px', lineHeight: '1.5', color: 'var(--muted)' }}>
                      On this phone? {hold.link ? <a href={hold.link}>Open your UPI app</a> : 'Open your UPI app'}, or screenshot the QR and open it from your UPI app&apos;s scanner. Put {hold.passId} in the note if the app asks.
                    </span>
                  </div>
                </div>

                <div style={S.col}>
                  <label htmlFor="rg-utr" style={S.label}>Step 2 · UTR number from your UPI app</label>
                  <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <input
                        id="rg-utr"
                        className="inp"
                        value={utr}
                        onChange={(e) => {
                          const v = e.currentTarget.value.toUpperCase().replace(/[^0-9A-Z ]/g, '').slice(0, 48)
                          setUtr(v)
                          clearErr('utr')
                          setUtrTouched((was) => v.replace(/\s/g, '').length >= 12 || (was && v.length > 0))
                        }}
                        onBlur={() => utr && setUtrTouched(true)}
                        type="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder="At least 12 characters"
                        aria-invalid={Boolean(u.bad)}
                        aria-describedby="rg-utr-msg"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '.08em', ...(u.bad ? { borderColor: 'var(--err-ink)', borderWidth: '4px' } : u.ok ? { borderColor: 'var(--mint-ink)' } : {}) }}
                      />
                      <span id="rg-utr-msg" aria-live="polite" style={{ fontSize: '12.5px', lineHeight: '1.5', color: u.bad ? 'var(--err-ink)' : u.ok ? 'var(--mint-ink)' : 'var(--muted)', minHeight: '1px' }}>
                        {u.msg}
                      </span>
                      <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.55', color: 'var(--muted)' }}>
                        UTR is the bank&apos;s reference for your payment. Each app names it differently: <strong style={{ color: 'var(--ink)' }}>UPI transaction ID</strong>, <strong style={{ color: 'var(--ink)' }}>UTR</strong> or <strong style={{ color: 'var(--ink)' }}>UPI Ref No.</strong> Usually 12 digits, sometimes longer. Copy it exactly as shown.
                      </p>
                    </div>
                    <Receipt amount={money(amount)} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={S.label}>Step 3 · screenshot of the receipt</span>
                  <input
                    id="rg-shot"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0]
                      e.currentTarget.value = ''
                      if (f) void onFile(f)
                    }}
                    style={{ position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', minHeight: '0', padding: '0', border: '0' }}
                  />
                  {up.status === 'none' ? (
                    <label className="rf-h3" htmlFor="rg-shot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '120px', border: '3px dashed var(--line-dash)', background: 'var(--surface)', cursor: 'pointer', padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '23.8px', color: 'var(--ink)' }}>+ ADD SCREENSHOT</span>
                      <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>JPG or PNG, under 5 MB. The one showing the amount and UTR.</span>
                    </label>
                  ) : null}
                  {up.status === 'uploading' ? (
                    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '3px solid var(--line)', background: 'var(--surface)', padding: '14px' }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', color: 'var(--ink)' }}>
                        <span style={{ wordBreak: 'break-all' }}>Uploading {up.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(up.pct)}%</span>
                      </span>
                      <span style={{ height: '10px', border: '2px solid var(--line)', background: 'var(--bar)', display: 'block', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.round(up.pct)}%`, background: '#FF9900' }} />
                      </span>
                    </div>
                  ) : null}
                  {up.status === 'done' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '3px solid var(--line)', background: 'var(--panel-mint)', padding: '12px' }}>
                      <span style={{ flex: 'none', width: '56px', height: '72px', border: '2px solid var(--line)', background: 'var(--bar)', backgroundImage: `url('${up.url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <span style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ ...S.rowL, color: 'var(--mint-ink)' }}>■ Uploaded</span>
                        <span style={{ fontSize: '13px', color: 'var(--ink)', wordBreak: 'break-all' }}>{up.name}</span>
                      </span>
                      <label htmlFor="rg-shot" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 12px', border: '2px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink)', cursor: 'pointer' }}>
                        Replace
                      </label>
                    </div>
                  ) : null}
                  {up.status === 'failed' ? (
                    <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '3px solid var(--err-ink)', background: 'var(--surface)', padding: '14px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--err-ink)' }}>✕ Did not upload</span>
                      <span style={{ fontSize: '13.5px', lineHeight: '1.5', color: 'var(--ink)' }}>{up.err}</span>
                      <label htmlFor="rg-shot" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 14px', background: 'var(--ink-fill)', color: 'var(--bg)', fontFamily: 'var(--font-display)', fontSize: '20px', cursor: 'pointer' }}>
                        TRY AGAIN
                      </label>
                    </div>
                  ) : null}
                  <span role="alert" style={S.err}>{err.shot}</span>
                </div>
                <Notice text={notice} />
                <p style={{ margin: '0', borderTop: '2px solid var(--line-soft)', paddingTop: '14px', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>
                  Refunds are available if you tell us at least two weeks before the event. Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with your Pass ID.
                </p>
              </div>
            ) : null}

            {phase === 'review' && hold ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingTop: 'clamp(6px,2vh,18px)' }}>
                <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', border: '3px solid var(--line)', background: 'var(--panel-gold)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', padding: '6px 10px' }}>
                  <span style={{ width: '9px', height: '9px', background: '#FF9900', border: '2px solid var(--line)' }} />
                  Received · being checked
                </span>
                <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,9.5vw,55px)', lineHeight: '1.02', color: 'var(--ink)' }}>WE HAVE YOUR DETAILS, {fullName.toUpperCase()}</h1>
                <p style={{ margin: '0', fontSize: '15.5px', lineHeight: '1.62', color: 'var(--body)', maxWidth: '46ch' }}>
                  A person on our team matches every UTR against the college bank statement, once a day. You will hear from us at <strong style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{fields.email}</strong> within 24 hours.
                </p>
                <div style={{ border: '4px solid var(--line)', background: '#FFFFFF', color: '#14161C', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '6px 6px 0 var(--sh)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#464C5C' }}>Your Pass ID · save it</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: 'clamp(24px,7.4vw,34px)', letterSpacing: '.04em', lineHeight: '1.1', color: '#14161C', wordBreak: 'break-all' }}>{hold.passId}</span>
                  <span style={{ fontSize: '13.5px', lineHeight: '1.55', color: '#33384A' }}>Screenshot this or copy it somewhere safe. You will need it for any question about your registration. It is in your email too.</span>
                  <button type="button" onClick={() => copy(hold.passId, 'id')} style={{ alignSelf: 'flex-start', minHeight: '48px', padding: '0 16px', background: '#14161C', color: '#FFFFFF', border: '0', fontFamily: 'var(--font-display)', fontSize: '21.3px' }}>
                    {copied === 'id' ? 'COPIED ✓' : 'COPY PASS ID'}
                  </button>
                </div>
                <ol style={{ margin: '0', padding: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', border: '3px solid var(--line)', background: 'var(--surface)' }}>
                  <Stage n="✓" done>Registration details received</Stage>
                  <Stage n="✓" done>
                    UTR <span style={{ fontFamily: 'var(--font-mono)' }}>{utrCompact}</span> and screenshot received
                  </Stage>
                  <Stage n="3" now note="Within 24 hours. Nothing for you to do.">
                    We check your payment
                  </Stage>
                  <Stage n="4">Confirmation email with your ticket</Stage>
                  <Stage n="5" last>
                    On the day: show your ticket at the gate
                  </Stage>
                </ol>
                <div style={{ border: '3px solid var(--line)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
                  {[
                    { label: 'Pass', value: t?.name ?? '' },
                    { label: 'Technical', value: techName },
                    ...(lvl >= 2 ? [{ label: 'Workshop', value: wsName }] : []),
                    { label: 'Amount sent', value: money(amount) },
                    { label: 'UTR', value: utrCompact },
                  ].map((r) => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
                      <span style={S.rowL}>{r.label}</span>
                      <span style={{ fontSize: '13.5px', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-word' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>
                  Refreshing will not change this page. The next thing you hear from us is an email. No email in 24 hours? Check spam, then write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with your Pass ID.
                </p>
              </div>
            ) : null}

            {expired ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingTop: 'clamp(10px,4vh,32px)' }}>
                <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', border: '3px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', padding: '6px 10px' }}>
                  <span style={{ width: '9px', height: '9px', background: 'var(--bar)', border: '2px solid var(--line)' }} />
                  Hold released
                </span>
                <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,9.5vw,55px)', lineHeight: '1.02', color: 'var(--ink)' }}>YOUR {holdMinutes} MINUTES RAN OUT</h1>
                <p style={{ margin: '0', fontSize: '15.5px', lineHeight: '1.62', color: 'var(--body)', maxWidth: '46ch' }}>
                  We did not get a UTR in time, so your place went back to the pool. Your details are still filled in on this device. Starting again takes a minute.
                </p>
                <div style={{ border: '3px solid var(--line)', background: 'var(--panel-gold)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ ...S.rowL, letterSpacing: '.16em', color: 'var(--amber-ink)' }}>Already sent the money?</span>
                  <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.6', color: 'var(--ink)' }}>
                    Do not pay again. Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with the UTR from your UPI app, and we will sort it out by hand.
                  </p>
                </div>
                <button type="button" onClick={restart} style={{ alignSelf: 'stretch', minHeight: '56px', padding: '0 20px', background: '#FF9900', color: '#14161C', border: '0', fontFamily: 'var(--font-display)', fontSize: '25px', boxShadow: '5px 5px 0 var(--line)' }}>
                  {'START AGAIN >'}
                </button>
                <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.6', color: 'var(--muted)' }}>The price you see next is whatever is live when you restart.</p>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <footer style={{ position: 'relative', zIndex: '10', borderTop: '3px solid var(--line-soft)', padding: '22px clamp(16px,5vw,28px) 30px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            awsscdhyd.in
          </Link>
          <p style={{ margin: '0', fontSize: '12.5px', lineHeight: '1.65', color: 'var(--muted)', maxWidth: '52ch' }}>AWS User Groups are run by independent volunteers and are not organized by AWS.</p>
        </div>
      </footer>

      {inForm ? (
        <div style={{ position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '20', background: 'var(--surface)', borderTop: '3px solid var(--line)', padding: '12px clamp(16px,5vw,40px)' }}>
          <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {step > 1 && !resume ? (
              <button type="button" onClick={goBack} disabled={busy} style={{ flex: 'none', minHeight: '52px', padding: '0 14px', border: '3px solid var(--line)', background: 'transparent', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: '21.3px' }}>
                BACK
              </button>
            ) : null}
            <div style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' }} aria-live="polite">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{barLabel}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '19px', color: 'var(--ink)' }}>{barValue}</span>
            </div>
            <button type="button" onClick={goNext} disabled={nextDisabled} aria-disabled={nextDisabled} style={{ opacity: nextDisabled ? '.4' : '1', flex: 'none', whiteSpace: 'nowrap', minHeight: '52px', padding: '0 clamp(14px,4vw,24px)', background: '#FF9900', color: '#14161C', border: '0', fontFamily: 'var(--font-display)', fontSize: 'clamp(20px,5.5vw,23.8px)', boxShadow: '5px 5px 0 var(--line)' }}>
              {nextLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ---- pieces ---------------------------------------------------------------- */

function Ticker() {
  const items = ['REGISTRATION · OPEN', '30.10.2026 · VJIT HYDERABAD', 'PICK A PASS · PAY BY UPI', 'LUNCH ON EVERY PASS']
  return (
    <span style={{ display: 'flex', gap: '26px', paddingRight: '26px', whiteSpace: 'nowrap' }}>
      {items.map((x) => (
        <span key={x} style={{ display: 'contents' }}>
          <span>{x}</span>
          <span style={{ color: '#9FE3B6' }}>◆</span>
        </span>
      ))}
    </span>
  )
}

function StepPass({ tier, pickTier, err }: { tier: Tier | null; pickTier: (t: Tier) => void; err?: string }) {
  const sel = TIERS.findIndex((x) => x.id === tier)
  const colBg = (i: number): CSSProperties => (i === sel ? { background: 'rgba(255,153,0,.16)' } : {})
  const cell: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 6px', borderBottom: '1px solid var(--line-soft)', borderLeft: '1px solid var(--line-soft)', fontFamily: 'var(--font-display)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 'clamp(16px,2vw,22px)', alignItems: 'stretch' }}>
        {TIERS.map((x, idx) => {
          const on = tier === x.id
          const level = TIER_LEVEL[x.id]
          return (
            <button
              key={x.id}
              className="rf-h1"
              type="button"
              onClick={() => pickTier(x.id)}
              aria-pressed={on}
              style={{
                position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', width: '100%', padding: '18px', textAlign: 'left', color: '#14161C', cursor: 'pointer',
                background: x.bg, ...(x.holo ? { backgroundSize: '260% 260%', animation: 'rf-holo 7s ease-in-out infinite alternate' } : {}),
                border: `4px solid ${x.edge}`, transition: 'transform .2s cubic-bezier(.2,.9,.3,1.2),box-shadow .2s ease',
                ...(on ? { outline: '4px solid #FF9900', outlineOffset: '4px', transform: 'translate3d(-4px,-4px,0)', boxShadow: `10px 10px 0 ${x.edge}` } : { boxShadow: '6px 6px 0 var(--sh)' }),
              }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', top: '0', bottom: '0', left: '-50%', width: '200%', pointerEvents: 'none', background: 'linear-gradient(100deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.7) 49%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.7) 51%,rgba(255,255,255,0) 60%)', animation: `rf-sheen ${4.6 + idx * 0.5}s ease-in-out infinite` }} />
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', paddingTop: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '.24em', color: '#14161C' }}>{x.metal}</span>
                <span style={{ display: 'flex', gap: '3px' }} aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} style={{ width: '9px', height: '9px', border: '2px solid #14161C', background: n <= level ? '#14161C' : 'transparent' }} />
                  ))}
                </span>
              </span>
              <span style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)', fontSize: x.holo ? '40px' : '34px', lineHeight: '.95',
                    backgroundImage: `linear-gradient(100deg,${x.dark} 0%,${x.dark} 35%,${x.light} 44%,#FFFFFF 50%,${x.light} 56%,${x.dark} 65%,${x.dark} 100%)`,
                    backgroundSize: '300% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
                    animation: `rf-foil 6.5s cubic-bezier(.45,0,.55,1) ${-idx * 1.6}s infinite`, filter: 'drop-shadow(2px 2px 0 rgba(255,255,255,.7))',
                  }}
                >
                  {x.name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '21px', color: '#FFFFFF', background: '#14161C', padding: '2px 8px' }}>{money(price(x.id))}</span>
              </span>
              <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '7px', width: '100%', borderTop: '2px solid rgba(20,22,28,.35)', paddingTop: '10px', textAlign: 'left' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', fontWeight: '600', letterSpacing: '.16em', color: '#14161C' }}>{x.from ? `EVERYTHING IN ${x.from}, PLUS` : 'THE FULL DAY'}</span>
                {x.adds.map((pk) => (
                  <span key={pk} style={{ fontSize: '13.5px', lineHeight: '1.35', color: '#1E1F26' }}>
                    + {pk}
                  </span>
                ))}
              </span>
              <span
                style={{
                  position: 'relative', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box', minHeight: '44px', fontFamily: 'var(--font-display)', fontSize: '21px',
                  ...(on ? { background: '#FF9900', color: '#14161C', border: '3px solid #14161C' } : { background: '#14161C', color: '#FFFFFF', border: '3px solid #14161C', boxShadow: '4px 4px 0 rgba(255,255,255,.7)' }),
                }}
              >
                {on ? '✓ THIS ONE' : `PICK ${x.name}`}
              </span>
            </button>
          )
        })}
      </div>
      <span role="alert" style={S.err}>{err}</span>

      <div style={S.col}>
        <div style={S.headRow}>
          <span style={S.eye}>{'// EVERY BENEFIT, SIDE BY SIDE'}</span>
          <span style={S.eyeR}>Tap a column to pick</span>
        </div>
        {/* position:relative so the table's sr-only labels, which are absolute, scroll with it instead of widening the page. */}
        <div style={{ position: 'relative', overflowX: 'auto', border: '3px solid var(--line)', background: 'var(--surface)', boxShadow: '6px 6px 0 var(--sh)' }}>
          <div role="table" aria-label="Pass benefits compared" style={{ minWidth: '560px', display: 'grid', gridTemplateColumns: 'minmax(180px,1.8fr) repeat(4,minmax(80px,1fr))' }}>
            <span role="columnheader" style={{ padding: '12px 14px', borderBottom: '3px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.18em', color: 'var(--muted)' }}>
              BENEFIT
            </span>
            {TIERS.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="columnheader"
                onClick={() => pickTier(x.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '10px 6px', border: '0', borderBottom: '3px solid var(--line)', borderLeft: '1px solid var(--line-soft)', cursor: 'pointer', color: i === sel ? '#14161C' : 'var(--ink)', background: i === sel ? '#FF9900' : 'transparent' }}
              >
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', lineHeight: '1' }}>{x.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600' }}>{money(price(x.id))}</span>
              </button>
            ))}
            {CMP.map(([label, need]) => (
              <Row key={label} label={label}>
                {TIERS.map((x, i) => {
                  const yes = TIER_LEVEL[x.id] >= need
                  return (
                    <span key={x.id} role="cell" style={{ ...cell, ...colBg(i), fontSize: yes ? '18px' : '16px', color: yes ? 'var(--mint-ink)' : 'var(--line-soft)' }}>
                      <span aria-hidden="true">{yes ? '■' : '–'}</span>
                      <span className="sr-only">{yes ? 'Included' : 'Not included'}</span>
                    </span>
                  )
                })}
              </Row>
            ))}
            <Row label="Swag kit">
              {TIERS.map((x, i) => (
                <span key={x.id} role="cell" style={{ ...cell, ...colBg(i), fontSize: '17px', color: 'var(--ink)' }}>
                  TIER {TIER_LEVEL[x.id]}
                </span>
              ))}
            </Row>
          </div>
        </div>
      </div>
      <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: 'var(--muted)' }}>Swag rises with the tier, and what is in it stays sealed until the day.</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="row" style={{ display: 'contents' }}>
      <span role="rowheader" style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', fontSize: '13.5px', lineHeight: '1.35', color: 'var(--ink)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Option({ code, level, title, on, onPick }: { code: string; level: Level; title: string; on: boolean; onPick: () => void }) {
  return (
    <button className="rf-h2" type="button" role="radio" onClick={onPick} aria-checked={on} style={optStyle(on)}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.18em', color: 'var(--muted)' }}>{code}</span>
          <span style={levelChip(level)}>{level.toUpperCase()}</span>
        </span>
        <span style={radioDot(on)} />
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '23px', lineHeight: '1.05', color: 'var(--ink)', textAlign: 'left', textWrap: 'pretty' }}>{title}</span>
    </button>
  )
}

function Extra({ lvl, pickTier, name, note, need, up, upName }: { lvl: number; pickTier: (t: Tier) => void; name: string; note: string; need: number; up?: Tier; upName?: string }) {
  const on = lvl >= need
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', ...(on ? {} : { background: 'repeating-linear-gradient(45deg,transparent 0 8px,var(--slot) 8px 16px)' }) }}>
      <span aria-hidden="true" style={{ flex: 'none', width: '24px', height: '24px', border: '3px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '19px', color: '#14161C', background: on ? '#9FE3B6' : 'transparent' }}>
        {on ? '✓' : ''}
      </span>
      <span style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: '1', color: on ? 'var(--ink)' : 'var(--muted)' }}>{name}</span>
        <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{on ? note : `Comes with ${upName} and above.`}</span>
      </span>
      {on ? (
        <span style={{ flex: 'none', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '.16em', color: 'var(--mint-ink)' }}>INCLUDED</span>
      ) : (
        <button type="button" onClick={() => up && pickTier(up)} style={{ flex: 'none', minHeight: '38px', padding: '0 10px', background: 'transparent', border: '2px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Upgrade · {upName}
        </button>
      )}
    </div>
  )
}

type FieldProps = {
  id: FieldKey
  label: string
  value: string
  onChange: (k: FieldKey, v: string) => void
  err?: string
  type?: string
  inputMode?: 'email' | 'numeric' | 'text'
  autoComplete?: string
  placeholder?: string
  min?: string
  max?: string
  style?: CSSProperties
  wrapStyle?: CSSProperties
  children?: ReactNode
}

/** Uncontrolled, as the handoff's inputs are, so typing never fights a re-render. */
function Field({ id, label, value, onChange, err, type = 'text', inputMode, autoComplete, placeholder, min, max, style, wrapStyle, children }: FieldProps) {
  return (
    <div style={{ ...S.field, ...wrapStyle }}>
      <label htmlFor={`rg-${id}`} style={S.label}>
        {label}
      </label>
      <input
        id={`rg-${id}`}
        className="inp"
        defaultValue={value}
        onChange={(e) => onChange(id, e.currentTarget.value)}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        min={min}
        max={max}
        aria-invalid={Boolean(err)}
        aria-describedby={`rg-${id}-e`}
        style={style}
      />
      {children}
      <span id={`rg-${id}-e`} style={S.err}>
        {err}
      </span>
    </div>
  )
}

function Stage({ n, done, now, last, note, children }: { n: string; done?: boolean; now?: boolean; last?: boolean; note?: string; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', ...(last ? {} : { borderBottom: '1px solid var(--line-soft)' }), ...(now ? { background: 'var(--panel-gold)' } : {}) }}>
      <span style={{ flex: 'none', width: '22px', height: '22px', border: '2px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(done ? { background: '#9FE3B6', color: '#14161C' } : now ? { background: '#FF9900', color: '#14161C' } : { color: 'var(--muted)' }) }}>
        {n}
      </span>
      {note ? (
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--ink)', fontWeight: '500' }}>{children}</span>
          <span style={{ fontSize: '12.5px', color: 'var(--body)' }}>{note}</span>
        </span>
      ) : (
        <span style={{ fontSize: '14px', lineHeight: '1.5', color: done ? 'var(--ink)' : 'var(--body)' }}>{children}</span>
      )}
    </li>
  )
}

function Coin() {
  return (
    <span aria-hidden="true" style={{ position: 'absolute', top: '-26px', right: '-30px', width: '66px', height: '66px', perspective: '260px', zIndex: '2' }}>
      <span style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', animation: 'rg-coin-pulse 1.8s ease-out infinite' }} />
      <span style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #14161C', background: 'radial-gradient(circle at 34% 28%,#FFF8DA 0%,#F7CF55 38%,#D89B1C 72%,#A86F08 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', animation: 'rg-coin-spin 4.2s linear infinite', boxShadow: 'inset 0 0 0 4px rgba(255,255,255,.35),inset -4px -5px 0 rgba(94,63,4,.35)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '34px', lineHeight: '1', color: '#5E3F04', textShadow: '1px 1px 0 #FFF3C4' }}>₹</span>
        <span style={{ position: 'absolute', top: '-20%', bottom: '-20%', left: '-60%', width: '40%', background: 'linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.9),rgba(255,255,255,0))', animation: 'rg-coin-shine 2.4s ease-in-out infinite' }} />
      </span>
    </span>
  )
}

function Receipt({ amount }: { amount: string }) {
  return (
    <div aria-hidden="true" style={{ border: '3px solid var(--line)', background: 'var(--surface)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '260px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)' }}>Where to find it · typical receipt</span>
      <div style={{ border: '2px solid var(--line-soft)', background: 'var(--bg)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', background: '#9FE3B6', border: '2px solid var(--line)' }} />
          <span style={{ fontSize: '11px', color: 'var(--body)' }}>Payment done</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '20px', color: 'var(--ink)' }}>{amount}</span>
        <span style={{ height: '6px', width: '70%', background: 'var(--bar)' }} />
        <span style={{ height: '6px', width: '45%', background: 'var(--bar)' }} />
        <span style={{ height: '0', borderTop: '2px dashed var(--line-soft)', margin: '4px 0' }} />
        <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>UPI transaction ID</span>
        <span style={{ position: 'relative', alignSelf: 'flex-start', fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: '#14161C', background: '#FF9900', padding: '3px 6px', boxShadow: '0 0 0 2px var(--line)' }}>4021 8839 1127</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.08em', color: 'var(--amber-ink)' }}>▲ THIS ONE</span>
        <span style={{ height: '6px', width: '55%', background: 'var(--bar)' }} />
      </div>
      <span style={{ fontSize: '11px', lineHeight: '1.45', color: 'var(--muted)' }}>Open the payment in your app&apos;s history if you closed the receipt.</span>
    </div>
  )
}

function Notice({ text }: { text: string }) {
  if (!text) return null
  return (
    <div role="alert" style={{ border: '3px solid var(--err-ink)', background: 'var(--surface)', padding: '12px 14px', fontSize: '14px', lineHeight: '1.5', color: 'var(--ink)' }}>
      {text}
    </div>
  )
}
