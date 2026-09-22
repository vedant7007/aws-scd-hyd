'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScanResult } from '@/app/api/admin/scan/route'
import { tierLabel } from '@/content/passes'
import type { FoodPreference } from '@/lib/db/types'
import {
  drainQueue,
  enqueue,
  lookupCached,
  saveRoster,
  type QueuedAction,
  type QueuedWrite,
  type RosterEntry,
} from '@/lib/scan-queue'

type Tone = 'ok' | 'repeat' | 'problem' | 'queued'

type Feedback = {
  tone: Tone
  passId: string
  name?: string
  tier?: string
  food?: string
  message: string
}

const DRAIN_INTERVAL_MS = 8000

/**
 * What the banner says. The word and the glyph carry the verdict; the
 * colour only repeats it, so a volunteer in sunlight, or one who cannot
 * tell mint from amber, still reads it right.
 */
const BANNER: Record<Tone, { text: string; note: string; glyph: string; tone: 'ok' | 'warn' | 'err' | 'queued' }> = {
  ok: { text: 'VALID PASS', note: 'let them in', glyph: '✓', tone: 'ok' },
  repeat: { text: 'DUPLICATE', note: 'check with lead', glyph: '!', tone: 'warn' },
  problem: { text: 'NOT ADMITTED', note: 'do not admit', glyph: '×', tone: 'err' },
  queued: { text: 'SAVED OFFLINE', note: 'sends itself later', glyph: '…', tone: 'queued' },
}

const FOOD_LABEL: Record<string, string> = { veg: 'VEG', nonveg: 'NON-VEG' } satisfies Record<FoodPreference, string>

async function post(passId: string, action: QueuedAction | 'lookup'): Promise<Response> {
  return fetch('/api/admin/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passId, action }),
  })
}

export function Scanner({ roster }: { roster: RosterEntry[] }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [queued, setQueued] = useState(0)
  const [cameraState, setCameraState] = useState<'idle' | 'running' | 'unsupported' | 'denied'>('idle')
  const [manual, setManual] = useState('')
  const lastScan = useRef<{ ref: string; at: number }>({ ref: '', at: 0 })

  const store = () => window.localStorage

  // Cache the roster so a scan still shows a name with no network.
  useEffect(() => {
    saveRoster(store(), roster)
  }, [roster])

  const drain = useCallback(async () => {
    const { remaining } = await drainQueue(store(), async (entry: QueuedWrite) => {
      const res = await post(entry.passId, entry.action)
      if (res.ok) return { delivered: true, retry: false }
      // 4xx is the server's considered answer, retrying will not change it.
      if (res.status >= 400 && res.status < 500) return { delivered: false, retry: false }
      return { delivered: false, retry: true }
    })
    setQueued(remaining)
  }, [])

  // Retry on a timer as well as on the online event, because a dead access
  // point often leaves navigator.onLine true and no event ever fires.
  // The first drain is deferred so no state is set synchronously during the
  // effect, which would cascade renders.
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

  const handle = useCallback(async (passId: string, action: QueuedAction | 'lookup') => {
    const ref = passId.trim()
    if (!ref) return

    try {
      const res = await post(ref, action)
      const data = (await res.json()) as ScanResult

      if (res.status === 404) {
        setFeedback({ tone: 'problem', passId: ref, message: 'No pass with that id. Send them to the help desk. Do not let them in on a screenshot alone.' })
        return
      }
      setFeedback({
        tone: data.repeat ? 'repeat' : data.ok ? 'ok' : 'problem',
        passId: ref,
        name: data.attendee?.name,
        tier: data.attendee?.tier,
        food: data.attendee?.foodPreference,
        message:
          data.message ??
          (action === 'lookup'
            ? data.checkedInAt
              ? `Already checked in at ${data.checkedInAt}.`
              : 'Not checked in yet.'
            : action === 'checkin'
              ? 'Checked in.'
              : 'Swag issued.'),
      })
    } catch {
      // Transport failure. Queue the write, and answer from the cached roster.
      const cached = lookupCached(store(), ref)
      if (action === 'lookup') {
        setFeedback({
          tone: cached ? 'queued' : 'problem',
          passId: ref,
          name: cached?.name,
          tier: cached?.tier,
          food: cached?.foodPreference,
          message: cached ? 'Offline, showing the cached roster.' : 'Offline and not in the cached roster.',
        })
        return
      }
      const next = enqueue(store(), {
        id: `${ref}:${action}`,
        passId: ref,
        action,
        queuedAt: new Date().toISOString(),
      })
      setQueued(next.length)
      setFeedback({
        tone: 'queued',
        passId: ref,
        name: cached?.name,
        tier: cached?.tier,
        food: cached?.foodPreference,
        message: 'Offline. Saved on this phone and will send itself when the network comes back.',
      })
    }
  }, [])

  const onDecoded = useCallback(
    (text: string) => {
      const now = Date.now()
      // The camera fires many times a second on the same badge.
      if (lastScan.current.ref === text && now - lastScan.current.at < 2500) return
      lastScan.current = { ref: text, at: now }
      void handle(text, 'lookup')
    },
    [handle],
  )

  async function startCamera() {
    // Checked here rather than on mount: a lazy initial state would differ
    // between server and client and mismatch on hydration.
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setCameraState('running')
      void runDecodeLoop(video, onDecoded)
    } catch {
      setCameraState('denied')
    }
  }

  const banner = feedback ? BANNER[feedback.tone] : null
  const isFood = (f: string | undefined): f is FoodPreference => f === 'veg' || f === 'nonveg'

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className={cameraState === 'running' ? 'pill pill-sm' : 'pill pill-ghost pill-sm'}>
          {cameraState === 'running' ? 'Camera on' : cameraState === 'denied' ? 'Camera refused' : cameraState === 'unsupported' ? 'No camera' : 'Camera off'}
        </span>
        <span role="status" className={queued ? 'pill pill-warn pill-sm' : 'pill pill-ghost pill-sm'}>
          {queued === 0 ? 'Nothing waiting to send' : `${queued} waiting to send`}
        </span>
      </div>

      <div className="cam">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        <span className="cam-vig" aria-hidden="true" />
        <span className="cam-frame" aria-hidden="true" />
        {cameraState === 'running' ? (
          <span className="cam-sweep" aria-hidden="true">
            <span />
          </span>
        ) : (
          <span className="cam-msg">
            {cameraState === 'denied'
              ? 'Camera blocked. Allow it in settings, or type the code'
              : cameraState === 'unsupported'
                ? 'No camera on this device. Type the code'
                : 'Tap start, then hold the pass inside the frame'}
          </span>
        )}
      </div>

      {cameraState !== 'running' ? (
        <button type="button" className="btn btn-primary btn-xl" onClick={startCamera} disabled={cameraState === 'unsupported'}>
          START CAMERA
        </button>
      ) : (
        <p className="lbl text-center">Hold the pass inside the frame</p>
      )}

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          void handle(manual, 'lookup')
        }}
      >
        <div className="fld">
          <label htmlFor="manual-ref">Or type the pass ID</label>
          <input id="manual-ref" className="inp inp-num" value={manual} onChange={(e) => setManual(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="SCD-" />
        </div>
        <button type="submit" className="btn btn-lg">
          LOOK UP
        </button>
      </form>

      {feedback && banner ? (
        <div className="card result-in flex flex-col" role="status" aria-live="polite">
          <div className="banner" data-tone={banner.tone}>
            <span className="banner-t">
              <span aria-hidden="true">{banner.glyph} </span>
              {banner.text}
            </span>
            <span className="banner-n">{banner.note}</span>
          </div>
          <div className="flex flex-col gap-3.5 p-4">
            <div className="flex flex-col gap-1.5">
              <span className="lbl-sm">Attendee</span>
              <span className="big-name">{feedback.name ?? 'UNKNOWN PASS'}</span>
              <span className="num text-[13px] text-muted">{feedback.passId}</span>
            </div>
            {feedback.name ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="card flex flex-col gap-1 p-3.5">
                  <span className="lbl-sm">Tier</span>
                  <span className="big-word">{(feedback.tier ? tierLabel(feedback.tier) : '-').toUpperCase()}</span>
                </div>
                <div className="card flex flex-col gap-1 p-3.5">
                  <span className="lbl-sm">Food</span>
                  <span className="big-word" data-tone={feedback.food === 'nonveg' ? 'err' : 'ok'}>
                    {isFood(feedback.food) ? FOOD_LABEL[feedback.food] : (feedback.food ?? '-')}
                  </span>
                </div>
              </div>
            ) : null}
            <p className="copy">{feedback.message}</p>
            <div className="flex flex-col gap-2.5">
              {feedback.tone !== 'problem' ? (
                <>
                  <button type="button" className="btn btn-mint btn-xl" onClick={() => void handle(feedback.passId, 'checkin')}>
                    CHECK IN
                  </button>
                  <button type="button" className="btn btn-lg" onClick={() => void handle(feedback.passId, 'swag')}>
                    MARK SWAG GIVEN
                  </button>
                </>
              ) : null}
              <button type="button" className="btn" onClick={() => setFeedback(null)}>
                NEXT PERSON
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
