'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GateCard, ScanResult } from '@/app/api/admin/scan/route'
import { passFor, tierLabel } from '@/content/passes'
import { TIER_LEVEL } from '@/content/program'
import type { Tier } from '@/lib/db/types'
import { drainQueue, enqueue, lookupCached, saveRoster, type QueuedWrite, type RosterEntry } from '@/lib/scan-queue'

/**
 * The gate, built for a queue. The camera starts once and stays on. A scan
 * opens a full screen card with everything about the person: the verdict in
 * words, their pass, every session they have, their group and Builder ID.
 * In fast mode a valid pass is checked in by the scan itself and the card
 * goes back to the camera on its own; otherwise one tap checks them in.
 * A sound and a buzz say the verdict before anyone reads it.
 *
 * Offline, a check in is saved on the phone and sent when the network comes
 * back, and the card is filled from the roster cached with the page.
 */

type Verdict = 'loading' | 'admitted' | 'ready' | 'duplicate' | 'blocked' | 'unknown' | 'queued'

type Card = {
  verdict: Verdict
  passId: string
  person?: GateCard
  checkedInAt?: string
  swagIssuedAt?: string
  message?: string
}

type Recent = { passId: string; name: string; verdict: Verdict; at: number }

const DRAIN_INTERVAL_MS = 8000
const AUTO_NEXT_MS = 2600
const MODE_KEY = 'scd.scan.fast'

const VERDICT: Record<Verdict, { title: string; note: string; glyph: string; tone: 'ok' | 'warn' | 'err' | 'info' }> = {
  loading: { title: 'CHECKING', note: 'one moment', glyph: '…', tone: 'info' },
  admitted: { title: 'WELCOME IN', note: 'checked in, let them through', glyph: '✓', tone: 'ok' },
  ready: { title: 'VALID PASS', note: 'tap check in', glyph: '✓', tone: 'ok' },
  duplicate: { title: 'ALREADY IN', note: 'this pass was used, check with the lead', glyph: '!', tone: 'warn' },
  blocked: { title: 'NOT ADMITTED', note: 'payment not verified, send to help desk', glyph: '×', tone: 'err' },
  unknown: { title: 'UNKNOWN PASS', note: 'not ours, send to help desk', glyph: '×', tone: 'err' },
  queued: { title: 'WELCOME IN', note: 'offline: saved on this phone, sends later', glyph: '✓', tone: 'ok' },
}

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '')

/** A pass id from whatever the QR holds: the id itself, or a link with it inside. */
const passIdIn = (text: string) => {
  const m = /SCD[-\s]?([A-Z0-9]{10})/i.exec(text)
  return m ? `SCD-${m[1]!.toUpperCase()}` : text.trim().toUpperCase()
}

async function post(passId: string, action: 'lookup' | 'checkin' | 'swag' | 'undo'): Promise<Response> {
  return fetch('/api/admin/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passId, action }) })
}

/** Two short high notes for yes, one low buzz for no. */
function signal(good: boolean) {
  try {
    navigator.vibrate?.(good ? 80 : [180, 80, 180])
    const ctx = new AudioContext()
    const notes = good ? [880, 1320] : [220]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      o.type = good ? 'sine' : 'square'
      g.gain.value = 0.08
      o.connect(g).connect(ctx.destination)
      const at = ctx.currentTime + i * 0.12
      o.start(at)
      o.stop(at + (good ? 0.1 : 0.35))
    })
    setTimeout(() => void ctx.close(), 800)
  } catch {
    // No sound on this device: the screen still says it.
  }
}

export function Scanner({ roster }: { roster: RosterEntry[] }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [card, setCard] = useState<Card | null>(null)
  const cardOpen = useRef(false)
  /** The pass just shown, so the same QR still in front of the camera does not reopen it. */
  const lastShown = useRef<{ ref: string; at: number }>({ ref: '', at: 0 })
  const [camera, setCamera] = useState<'idle' | 'running' | 'unsupported' | 'denied'>('idle')
  const [fast, setFast] = useState(true)
  const [queued, setQueued] = useState(0)
  const [manual, setManual] = useState('')
  const [recent, setRecent] = useState<Recent[]>([])
  const [inside, setInside] = useState(() => new Set(roster.filter((r) => r.checkedIn).map((r) => r.passId)))
  const [autoLeft, setAutoLeft] = useState(0)
  const store = () => window.localStorage

  useEffect(() => {
    saveRoster(store(), roster)
    try {
      // Read after hydration: the server has no storage to agree with.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFast(localStorage.getItem(MODE_KEY) !== '0')
    } catch {
      // Storage blocked: fast mode stays on.
    }
  }, [roster])

  const drain = useCallback(async () => {
    const { remaining } = await drainQueue(store(), async (entry: QueuedWrite) => {
      const res = await post(entry.passId, entry.action)
      if (res.ok) return { delivered: true, retry: false }
      if (res.status >= 400 && res.status < 500) return { delivered: false, retry: false }
      return { delivered: false, retry: true }
    })
    setQueued(remaining)
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void drain(), 0)
    const id = setInterval(() => void drain(), DRAIN_INTERVAL_MS)
    window.addEventListener('online', drain)
    return () => {
      clearTimeout(first)
      clearInterval(id)
      window.removeEventListener('online', drain)
    }
  }, [drain])

  const close = useCallback(() => {
    lastShown.current = { ref: lastShown.current.ref, at: Date.now() }
    cardOpen.current = false
    setCard(null)
    setAutoLeft(0)
  }, [])

  // Fast mode: a clean check in goes back to the camera on its own.
  useEffect(() => {
    if (!card || !fast || (card.verdict !== 'admitted' && card.verdict !== 'queued')) return
    const started = Date.now()
    const id = setInterval(() => {
      const left = AUTO_NEXT_MS - (Date.now() - started)
      if (left <= 0) {
        clearInterval(id)
        close()
      } else setAutoLeft(left)
    }, 100)
    return () => clearInterval(id)
  }, [card, fast, close])

  const fromCache = (ref: string): GateCard | undefined => {
    const c = lookupCached(store(), ref) as RosterEntry | null
    return c ? { name: c.name, tier: c.tier, college: c.college, technical: c.technical ?? '', workshop: c.workshop ?? null, builderId: c.builderId ?? null, group: c.group ?? null } : undefined
  }

  const remember = (passId: string, name: string, verdict: Verdict) => setRecent((r) => [{ passId, name, verdict, at: Date.now() }, ...r.filter((x) => x.passId !== passId)].slice(0, 6))

  const open = useCallback(
    async (raw: string, action: 'lookup' | 'checkin') => {
      const ref = passIdIn(raw)
      if (!ref) return
      cardOpen.current = true
      lastShown.current = { ref, at: Date.now() }
      setCard({ verdict: 'loading', passId: ref, person: fromCache(ref) })
      try {
        const res = await post(ref, action)
        const data = (await res.json()) as ScanResult
        let verdict: Verdict
        if (res.status === 404 || res.status === 400) verdict = 'unknown'
        else if (!data.ok) verdict = 'blocked'
        else if (data.repeat || (action === 'lookup' && data.checkedInAt)) verdict = 'duplicate'
        else verdict = action === 'checkin' ? 'admitted' : 'ready'
        setCard({ verdict, passId: ref, person: data.attendee, checkedInAt: data.checkedInAt, swagIssuedAt: data.swagIssuedAt, message: data.message })
        if (verdict === 'admitted') setInside((s) => new Set(s).add(ref))
        remember(ref, data.attendee?.name ?? 'Unknown', verdict)
        signal(verdict === 'admitted' || verdict === 'ready')
      } catch {
        const person = fromCache(ref)
        if (person && action === 'checkin') {
          setQueued(enqueue(store(), { id: `${ref}:checkin`, passId: ref, action: 'checkin', queuedAt: new Date().toISOString() }).length)
          setInside((s) => new Set(s).add(ref))
          setCard({ verdict: 'queued', passId: ref, person })
          remember(ref, person.name, 'queued')
          signal(true)
        } else {
          setCard({ verdict: person ? 'ready' : 'unknown', passId: ref, person, message: person ? 'Offline: showing the saved list.' : 'Offline, and this pass is not in the saved list.' })
          signal(Boolean(person))
        }
      }
    },
    // fromCache and remember only touch storage and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const act = async (action: 'checkin' | 'swag' | 'undo') => {
    if (!card) return
    const ref = card.passId
    try {
      const res = await post(ref, action)
      const data = (await res.json()) as ScanResult
      if (action === 'checkin') {
        const verdict: Verdict = data.repeat ? 'duplicate' : data.ok ? 'admitted' : 'blocked'
        setCard({ ...card, verdict, checkedInAt: data.checkedInAt, swagIssuedAt: data.swagIssuedAt, message: data.message })
        if (verdict === 'admitted') setInside((s) => new Set(s).add(ref))
        signal(verdict === 'admitted')
      } else if (action === 'swag') {
        setCard({ ...card, swagIssuedAt: data.swagIssuedAt, message: data.repeat ? data.message : 'Swag kit given.' })
      } else {
        setCard({ ...card, verdict: 'ready', checkedInAt: undefined, message: 'Check in undone.' })
        setInside((s) => {
          const n = new Set(s)
          n.delete(ref)
          return n
        })
      }
    } catch {
      if (action === 'checkin' || action === 'swag') {
        setQueued(enqueue(store(), { id: `${ref}:${action}`, passId: ref, action, queuedAt: new Date().toISOString() }).length)
        setCard({ ...card, verdict: action === 'checkin' ? 'queued' : card.verdict, message: 'Offline: saved on this phone, sends later.' })
      }
    }
  }

  const onDecoded = useCallback(
    (text: string) => {
      if (cardOpen.current) return
      const ref = passIdIn(text)
      if (ref === lastShown.current.ref && Date.now() - lastShown.current.at < 4000) return
      void open(text, fast ? 'checkin' : 'lookup')
    },
    [open, fast],
  )
  const decodedRef = useRef(onDecoded)
  useEffect(() => {
    decodedRef.current = onDecoded
  }, [onDecoded])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera('unsupported')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setCamera('running')
      void runDecodeLoop(video, (t) => decodedRef.current(t))
    } catch {
      setCamera('denied')
    }
  }

  const toggleFast = () => {
    setFast((f) => {
      try {
        localStorage.setItem(MODE_KEY, f ? '0' : '1')
      } catch {
        // Not remembered; fine for this session.
      }
      return !f
    })
  }

  return (
    <div className="gate">
      <div className="gate-top">
        <div className="flex flex-col gap-1">
          <span className="eye">{'// THE GATE'}</span>
          <span className="gate-count">
            <strong>{inside.size}</strong> / {roster.length} IN
          </span>
        </div>
        <button type="button" className="gate-mode" data-on={fast ? '1' : undefined} onClick={toggleFast} aria-pressed={fast}>
          <span className="gate-mode-dot" aria-hidden="true" />
          {fast ? 'FAST MODE · scan checks in' : 'CHECK MODE · tap to check in'}
        </button>
      </div>

      <div className="cam gate-cam">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        <span className="cam-vig" aria-hidden="true" />
        <span className="cam-frame" aria-hidden="true" />
        {camera === 'running' ? (
          <span className="cam-sweep" aria-hidden="true">
            <span />
          </span>
        ) : (
          <span className="cam-msg">
            {camera === 'denied' ? 'Camera blocked. Allow it in settings, or type the pass ID below' : camera === 'unsupported' ? 'No camera here. Type the pass ID below' : 'Start the camera once; it stays on'}
          </span>
        )}
      </div>

      {camera !== 'running' ? (
        <button type="button" className="btn btn-primary btn-xl" onClick={startCamera} disabled={camera === 'unsupported'}>
          START CAMERA
        </button>
      ) : (
        <p className="gate-hint">Point at the QR on their pass. No need to tap.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={camera === 'running' ? 'pill pill-sm' : 'pill pill-ghost pill-sm'}>{camera === 'running' ? 'Camera on' : 'Camera off'}</span>
        <span role="status" className={queued ? 'pill pill-warn pill-sm' : 'pill pill-ghost pill-sm'}>
          {queued ? `${queued} saved offline, sending…` : 'All synced'}
        </span>
      </div>

      <form
        className="gate-manual"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) void open(manual, 'lookup')
          setManual('')
        }}
      >
        <label htmlFor="manual-ref" className="lbl">
          QR not scanning? Type the pass ID
        </label>
        <div className="flex gap-2">
          <input id="manual-ref" className="inp inp-num min-w-0 flex-1" value={manual} onChange={(e) => setManual(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="SCD-" />
          <button type="submit" className="btn">
            FIND
          </button>
        </div>
      </form>

      {recent.length ? (
        <section className="flex flex-col gap-2" aria-label="Recent scans">
          <span className="lbl">Recent</span>
          {recent.map((r) => (
            <button key={r.passId} type="button" className="gate-recent" data-tone={VERDICT[r.verdict].tone} onClick={() => void open(r.passId, 'lookup')}>
              <span className="gate-recent-g" aria-hidden="true">
                {VERDICT[r.verdict].glyph}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{r.name}</span>
              <span className="num text-[11px] text-muted">{new Date(r.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          ))}
        </section>
      ) : null}

      {/* On body, not in the page: the page's entry animation is a transform, and a fixed card inside it would be boxed by it. */}
      {card ? createPortal(<GateSheet card={card} fast={fast} autoLeft={autoLeft} onClose={close} onAct={act} />, document.body) : null}
    </div>
  )
}

function GateSheet({ card, fast, autoLeft, onClose, onAct }: { card: Card; fast: boolean; autoLeft: number; onClose: () => void; onAct: (a: 'checkin' | 'swag' | 'undo') => void }) {
  const v = VERDICT[card.verdict]
  const p = card.person
  const pass = p ? passFor(p.tier as Tier) : undefined
  const level = p ? TIER_LEVEL[p.tier as Tier] : 0
  // Everything on the pass, with the sessions they picked named.
  const plan = (pass?.perks ?? [])
    .filter((x) => !/^Swag kit/.test(x))
    .map((x) => (/technical session/i.test(x) && p?.technical ? `Technical · ${p.technical}` : /workshop/i.test(x) && p?.workshop ? `Workshop · ${p.workshop}` : x))
  const checkedIn = card.verdict === 'admitted' || card.verdict === 'queued' || card.verdict === 'duplicate'

  return (
    <div className="gate-sheet" data-tone={v.tone} role="dialog" aria-modal="true" aria-label={`${v.title}: ${p?.name ?? card.passId}`}>
      <div className="gate-verdict">
        <span className="gate-glyph" aria-hidden="true">
          {v.glyph}
        </span>
        <span className="flex flex-col">
          <span className="gate-v-title">{v.title}</span>
          <span className="gate-v-note">
            {card.verdict === 'duplicate' && card.checkedInAt ? `checked in at ${time(card.checkedInAt)} · ${v.note}` : v.note}
          </span>
        </span>
      </div>
      {fast && autoLeft > 0 ? (
        <span className="gate-auto" aria-hidden="true">
          <span style={{ width: `${(autoLeft / AUTO_NEXT_MS) * 100}%` }} />
        </span>
      ) : null}

      <div className="gate-body">
        <span className="gate-name">{p?.name ?? (card.verdict === 'loading' ? '' : 'NOT FOUND')}</span>
        <span className="flex flex-wrap items-center gap-2">
          {p ? (
            <span className="gate-tier" data-tier={p.tier}>
              {tierLabel(p.tier as Tier).toUpperCase()}
            </span>
          ) : null}
          <span className="num text-[13px] text-muted">{card.passId}</span>
        </span>
        {p ? <span className="copy">{p.college}</span> : null}

        {p && card.verdict !== 'blocked' && card.verdict !== 'unknown' ? (
          <>
            <div className="gate-plan">
              <span className="lbl-sm">Their day</span>
              <ul>
                {plan.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="gate-fact">
                <span className="lbl-sm">Swag kit</span>
                <span className="gate-fact-v">Tier {level}</span>
                <span className="hint">{card.swagIssuedAt ? `Given at ${time(card.swagIssuedAt)}` : 'Not given yet'}</span>
              </div>
              <div className="gate-fact">
                <span className="lbl-sm">{p.group ? 'Group' : 'Builder ID'}</span>
                <span className="gate-fact-v">{p.group ? `Group of ${p.group.size}` : p.builderId ? `@${p.builderId}` : '-'}</span>
                <span className="hint">{p.group ? (p.group.payer ? 'Paid for the group' : 'Paid by their group') : 'AWS Builder Center'}</span>
              </div>
            </div>
          </>
        ) : null}

        {card.message && card.verdict !== 'duplicate' ? <p className="copy">{card.message}</p> : null}
      </div>

      <div className="gate-actions">
        {card.verdict === 'ready' ? (
          <button type="button" className="btn btn-mint btn-xl" onClick={() => onAct('checkin')}>
            ✓ CHECK IN
          </button>
        ) : null}
        <button type="button" className={card.verdict === 'ready' ? 'btn btn-lg' : 'btn btn-primary btn-xl'} onClick={onClose}>
          {'NEXT SCAN >'}
        </button>
        {p && checkedIn ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" onClick={() => onAct('swag')} disabled={Boolean(card.swagIssuedAt)}>
              {card.swagIssuedAt ? 'SWAG GIVEN ✓' : 'GIVE SWAG'}
            </button>
            <button type="button" className="btn" onClick={() => onAct('undo')}>
              UNDO CHECK IN
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Native BarcodeDetector where it exists, jsQR everywhere else. iOS Safari and
 * Firefox have no BarcodeDetector, and the scanner has to work on whichever
 * phone the volunteer on the gate happens to own.
 */
async function runDecodeLoop(video: HTMLVideoElement, onDecoded: (text: string) => void): Promise<void> {
  type DetectedBarcode = { rawValue: string }
  type DetectorCtor = new (options?: { formats?: string[] }) => { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
  const Detector = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null
  const jsQR = detector ? null : (await import('jsqr')).default

  const tick = async () => {
    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      try {
        if (detector) {
          const found = await detector.detect(canvas)
          if (found[0]?.rawValue) onDecoded(found[0].rawValue)
        } else if (jsQR) {
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const found = jsQR(image.data, image.width, image.height)
          if (found?.data) onDecoded(found.data)
        }
      } catch {
        // A single bad frame is not worth stopping the loop for.
      }
    }
    requestAnimationFrame(() => void tick())
  }

  void tick()
}
