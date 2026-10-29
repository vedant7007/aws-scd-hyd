'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GateCard, ScanResult } from '@/app/api/admin/scan/route'
import { passFor, tierLabel } from '@/content/passes'
import { TIER_LEVEL } from '@/content/program'
import type { Tier } from '@/lib/db/types'
import { drainQueue, enqueue, lookupCached, saveRoster, type QueuedWrite, type RosterEntry } from '@/lib/scan-queue'

/**
 * The gate, built for a queue. The camera starts once and stays on. The
 * volunteer picks their station: the gate, the swag table, the lunch counter,
 * the light food counter, or look up only. A scan does that station's one job
 * and opens a full screen card with the person and four big tiles, check in,
 * swag, lunch token and light food, each one tap to mark and one to undo. The
 * card stays until the volunteer taps NEXT SCAN; nothing closes on its own.
 * A sound and a buzz say the verdict before anyone reads it.
 *
 * Offline, a mark is saved on the phone and sent when the network comes
 * back, and the card is filled from the roster cached with the page.
 */

type Mark = 'checkin' | 'swag' | 'lunch' | 'snack'
type Station = Mark | 'lookup'

type Verdict = 'loading' | 'done' | 'ready' | 'repeat' | 'blocked' | 'unknown' | 'queued'

type Card = {
  verdict: Verdict
  /** What the scan tried to do. */
  station: Station
  passId: string
  person?: GateCard
  checkedInAt?: string
  swagIssuedAt?: string
  lunchAt?: string
  snackAt?: string
  message?: string
}

type Recent = { passId: string; name: string; tone: Tone; at: number }
type Tone = 'ok' | 'warn' | 'err' | 'info'

const DRAIN_INTERVAL_MS = 8000
const STATION_KEY = 'scd.scan.station'

const MARK_FIELD = { checkin: 'checkedInAt', swag: 'swagIssuedAt', lunch: 'lunchAt', snack: 'snackAt' } as const
const MARK_LABEL: Record<Mark, string> = { checkin: 'CHECKED IN', swag: 'SWAG KIT', lunch: 'LUNCH TOKEN', snack: 'LIGHT FOOD' }
/** The tile before it is marked: what to do. */
const MARK_TODO: Record<Mark, string> = { checkin: 'CHECK IN', swag: 'GIVE SWAG', lunch: 'GIVE LUNCH TOKEN', snack: 'GIVE LIGHT FOOD' }

const STATIONS: { id: Station; label: string; hint: string }[] = [
  { id: 'checkin', label: 'GATE', hint: 'scan checks them in' },
  { id: 'swag', label: 'SWAG', hint: 'scan gives the swag kit' },
  { id: 'lunch', label: 'LUNCH', hint: 'scan gives the lunch token' },
  { id: 'snack', label: 'LIGHT FOOD', hint: 'scan gives light food' },
  { id: 'lookup', label: 'LOOK UP', hint: 'scan only shows the pass' },
]

/** The headline for a card: what happened, in words a volunteer reads at a glance. */
function headline(c: Card): { title: string; note: string; glyph: string; tone: Tone } {
  const job = c.station === 'lookup' ? null : c.station
  switch (c.verdict) {
    case 'loading':
      return { title: 'CHECKING', note: 'one moment', glyph: '…', tone: 'info' }
    case 'blocked':
      return { title: 'NOT ADMITTED', note: 'payment not verified, send to help desk', glyph: '×', tone: 'err' }
    case 'unknown':
      return { title: 'UNKNOWN PASS', note: 'not ours, send to help desk', glyph: '×', tone: 'err' }
    case 'ready':
      return { title: 'VALID PASS', note: c.checkedInAt ? `checked in at ${time(c.checkedInAt)}` : 'not checked in yet', glyph: '✓', tone: 'ok' }
    case 'queued':
      return { title: job === 'checkin' ? 'WELCOME IN' : `${MARK_LABEL[job ?? 'checkin']} GIVEN`, note: 'offline: saved on this phone, sends later', glyph: '✓', tone: 'ok' }
    case 'repeat': {
      const at = job ? time(c[MARK_FIELD[job]]) : ''
      return job === 'checkin'
        ? { title: 'ALREADY IN', note: `checked in at ${at} · same pass twice? check with the lead`, glyph: '!', tone: 'warn' }
        : { title: `${MARK_LABEL[job ?? 'swag']} ALREADY GIVEN`, note: `given at ${at} · do not give again`, glyph: '!', tone: 'warn' }
    }
    case 'done':
      return job === 'checkin'
        ? { title: 'WELCOME IN', note: 'checked in, let them through', glyph: '✓', tone: 'ok' }
        : { title: `GIVE ${MARK_LABEL[job ?? 'swag']}`, note: 'marked as given', glyph: '✓', tone: 'ok' }
  }
}

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '')

/** A pass id from whatever the QR holds: the id itself, or a link with it inside. */
const passIdIn = (text: string) => {
  const m = /SCD[-\s]?([A-Z0-9]{10})/i.exec(text)
  return m ? `SCD-${m[1]!.toUpperCase()}` : text.trim().toUpperCase()
}

async function post(passId: string, action: Station | 'undo', what?: Mark): Promise<Response> {
  return fetch('/api/admin/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passId, action, what }) })
}

/** Two short high notes for yes, one low buzz for no or a repeat. */
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
  const [station, setStation] = useState<Station>('checkin')
  const [queued, setQueued] = useState(0)
  const [manual, setManual] = useState('')
  const [recent, setRecent] = useState<Recent[]>([])
  const [inside, setInside] = useState(() => new Set(roster.filter((r) => r.checkedIn).map((r) => r.passId)))
  const [busy, setBusy] = useState<string | null>(null)
  const store = () => window.localStorage

  useEffect(() => {
    saveRoster(store(), roster)
    try {
      // Read after hydration: the server has no storage to agree with.
      const saved = localStorage.getItem(STATION_KEY) as Station | null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && STATIONS.some((x) => x.id === saved)) setStation(saved)
    } catch {
      // Storage blocked: the gate station it is.
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
  }, [])

  const fromCache = (ref: string): GateCard | undefined => {
    const c = lookupCached(store(), ref) as RosterEntry | null
    return c ? { name: c.name, tier: c.tier, college: c.college, technical: c.technical ?? '', workshop: c.workshop ?? null, builderId: c.builderId ?? null, group: c.group ?? null, food: null, bus: null, busStop: null } : undefined
  }

  const remember = (passId: string, name: string, tone: Tone) => setRecent((r) => [{ passId, name, tone, at: Date.now() }, ...r.filter((x) => x.passId !== passId)].slice(0, 8))

  const open = useCallback(
    async (raw: string, job: Station) => {
      const ref = passIdIn(raw)
      if (!ref) return
      cardOpen.current = true
      lastShown.current = { ref, at: Date.now() }
      setCard({ verdict: 'loading', station: job, passId: ref, person: fromCache(ref) })
      try {
        const res = await post(ref, job)
        const data = (await res.json()) as ScanResult
        let verdict: Verdict
        if (res.status === 404 || res.status === 400) verdict = 'unknown'
        else if (!data.ok) verdict = 'blocked'
        else if (data.repeat) verdict = 'repeat'
        else verdict = job === 'lookup' ? 'ready' : 'done'
        const next: Card = { verdict, station: job, passId: ref, person: data.attendee, checkedInAt: data.checkedInAt, swagIssuedAt: data.swagIssuedAt, lunchAt: data.lunchAt, snackAt: data.snackAt, message: data.message }
        setCard(next)
        if (data.checkedInAt) setInside((s) => new Set(s).add(ref))
        remember(ref, data.attendee?.name ?? 'Unknown', headline(next).tone)
        signal(verdict === 'done' || verdict === 'ready')
      } catch {
        const person = fromCache(ref)
        if (person && job !== 'lookup') {
          setQueued(enqueue(store(), { id: `${ref}:${job}`, passId: ref, action: job, queuedAt: new Date().toISOString() }).length)
          if (job === 'checkin') setInside((s) => new Set(s).add(ref))
          setCard({ verdict: 'queued', station: job, passId: ref, person })
          remember(ref, person.name, 'ok')
          signal(true)
        } else {
          setCard({ verdict: person ? 'ready' : 'unknown', station: 'lookup', passId: ref, person, message: person ? 'Offline: showing the saved list.' : 'Offline, and this pass is not in the saved list.' })
          signal(Boolean(person))
        }
      }
    },
    // fromCache and remember only touch storage and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /** A tap on a tile: mark it, or undo it. The card stays open either way. */
  const act = async (mark: Mark, undo: boolean) => {
    if (!card || busy) return
    const ref = card.passId
    const field = MARK_FIELD[mark]
    setBusy(mark)
    try {
      const res = await post(ref, undo ? 'undo' : mark, undo ? mark : undefined)
      const data = (await res.json()) as ScanResult
      if (!res.ok) throw new Error(String(res.status))
      setCard((c) => (c ? { ...c, [field]: undo ? undefined : data[field], message: undo ? `${MARK_LABEL[mark]} undone.` : data.repeat ? data.message : `${MARK_LABEL[mark]} marked.` } : c))
      if (mark === 'checkin')
        setInside((s) => {
          const n = new Set(s)
          if (undo) n.delete(ref)
          else n.add(ref)
          return n
        })
      if (!undo) signal(!data.repeat)
    } catch {
      if (!undo) {
        setQueued(enqueue(store(), { id: `${ref}:${mark}`, passId: ref, action: mark, queuedAt: new Date().toISOString() }).length)
        setCard((c) => (c ? { ...c, [field]: new Date().toISOString(), message: 'Offline: saved on this phone, sends later.' } : c))
      } else setCard((c) => (c ? { ...c, message: 'No connection. Undo again when the network is back.' } : c))
    } finally {
      setBusy(null)
    }
  }

  const onDecoded = useCallback(
    (text: string) => {
      if (cardOpen.current) return
      const ref = passIdIn(text)
      if (ref === lastShown.current.ref && Date.now() - lastShown.current.at < 4000) return
      void open(text, station)
    },
    [open, station],
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

  const pick = (s: Station) => {
    setStation(s)
    try {
      localStorage.setItem(STATION_KEY, s)
    } catch {
      // Not remembered; fine for this session.
    }
  }
  const here = STATIONS.find((x) => x.id === station)!

  return (
    <div className="gate">
      <div className="gate-top">
        <div className="flex flex-col gap-1">
          <span className="eye">{'// THE GATE'}</span>
          <span className="gate-count">
            <strong>{inside.size}</strong> / {roster.length} IN
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="lbl">I am at</span>
        <div className="gate-stations" role="radiogroup" aria-label="Station">
          {STATIONS.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={station === x.id} className="gate-station" data-on={station === x.id ? '1' : undefined} onClick={() => pick(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <span className="gate-hint text-left">{here.hint}</span>
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
          <span className="lbl">Recent · tap to open again</span>
          {recent.map((r) => (
            <button key={r.passId} type="button" className="gate-recent" data-tone={r.tone} onClick={() => void open(r.passId, 'lookup')}>
              <span className="gate-recent-g" aria-hidden="true">
                {r.tone === 'ok' ? '✓' : r.tone === 'warn' ? '!' : '×'}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{r.name}</span>
              <span className="num text-[11px] text-muted">{new Date(r.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          ))}
        </section>
      ) : null}

      {/* On body, not in the page: the page's entry animation is a transform, and a fixed card inside it would be boxed by it. */}
      {card ? createPortal(<GateSheet card={card} busy={busy} onClose={close} onAct={act} />, document.body) : null}
    </div>
  )
}

function GateSheet({ card, busy, onClose, onAct }: { card: Card; busy: string | null; onClose: () => void; onAct: (m: Mark, undo: boolean) => void }) {
  const v = headline(card)
  const p = card.person
  const pass = p ? passFor(p.tier as Tier) : undefined
  const level = p ? TIER_LEVEL[p.tier as Tier] : 0
  // Everything on the pass, with the sessions they picked named.
  const plan = (pass?.perks ?? [])
    .filter((x) => !/^Swag kit/.test(x))
    .map((x) => (/technical session/i.test(x) && p?.technical ? `Technical · ${p.technical}` : /workshop/i.test(x) && p?.workshop ? `Workshop · ${p.workshop}` : x))
  const valid = p && card.verdict !== 'blocked' && card.verdict !== 'unknown' && card.verdict !== 'loading'
  const tileNote: Record<Mark, string> = {
    checkin: 'at the gate',
    swag: `tier ${level} kit`,
    lunch: p?.food ?? 'food not chosen',
    snack: 'one per pass',
  }

  return (
    <div className="gate-sheet" data-tone={v.tone} role="dialog" aria-modal="true" aria-label={`${v.title}: ${p?.name ?? card.passId}`}>
      <div className="gate-verdict">
        <span className="gate-glyph" aria-hidden="true">
          {v.glyph}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="gate-v-title">{v.title}</span>
          <span className="gate-v-note">{v.note}</span>
        </span>
      </div>

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

        {valid ? (
          <div className="gate-tiles">
            {(Object.keys(MARK_FIELD) as Mark[]).map((m) => {
              const at = card[MARK_FIELD[m]]
              return (
                <div key={m} className="gate-tile" data-done={at ? '1' : undefined}>
                  <button type="button" className="gate-tile-main" disabled={Boolean(at) || busy !== null} onClick={() => onAct(m, false)}>
                    <span className="gate-tile-k">{at ? `✓ ${MARK_LABEL[m]}` : MARK_TODO[m]}</span>
                    <span className="gate-tile-v">{busy === m ? '…' : at ? `at ${time(at)}` : 'TAP WHEN DONE'}</span>
                    <span className="gate-tile-n">{tileNote[m]}</span>
                  </button>
                  {at ? (
                    <button type="button" className="gate-tile-undo" disabled={busy !== null} onClick={() => confirm(`Undo ${MARK_LABEL[m].toLowerCase()} for ${p.name}?`) && onAct(m, true)}>
                      undo
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {card.message && card.verdict !== 'repeat' ? <p className="copy">{card.message}</p> : null}

        {valid ? (
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
                <span className="lbl-sm">{p.group ? 'Group' : 'Builder ID'}</span>
                <span className="gate-fact-v">{p.group ? `Group of ${p.group.size}` : p.builderId ? `@${p.builderId}` : '-'}</span>
                <span className="hint">{p.group ? (p.group.payer ? 'Paid for the group' : 'Paid by their group') : 'AWS Builder Center'}</span>
              </div>
              <div className="gate-fact">
                <span className="lbl-sm">College bus</span>
                <span className="gate-fact-v">{p.bus ?? 'Not chosen'}</span>
                <span className="hint">{p.busStop ? `Stop: ${p.busStop}` : ' '}</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="gate-actions">
        <button type="button" className="btn btn-primary btn-xl" onClick={onClose}>
          {'NEXT SCAN >'}
        </button>
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
