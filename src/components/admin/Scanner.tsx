'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScanResult } from '@/app/api/admin/scan/route'
import {
  drainQueue,
  enqueue,
  lookupCached,
  saveRoster,
  type QueuedAction,
  type QueuedWrite,
  type RosterEntry,
} from '@/lib/scan-queue'

type Feedback = {
  tone: 'ok' | 'repeat' | 'problem' | 'queued'
  ticketRef: string
  name?: string
  tier?: string
  food?: string
  message: string
}

const DRAIN_INTERVAL_MS = 8000

async function post(ticketRef: string, action: QueuedAction | 'lookup'): Promise<Response> {
  return fetch('/api/admin/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticketRef, action }),
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
      const res = await post(entry.ticketRef, entry.action)
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

  const handle = useCallback(async (ticketRef: string, action: QueuedAction | 'lookup') => {
    const ref = ticketRef.trim()
    if (!ref) return

    try {
      const res = await post(ref, action)
      const data = (await res.json()) as ScanResult

      if (res.status === 404) {
        setFeedback({ tone: 'problem', ticketRef: ref, message: 'No ticket with that reference.' })
        return
      }
      setFeedback({
        tone: data.repeat ? 'repeat' : data.ok ? 'ok' : 'problem',
        ticketRef: ref,
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
          ticketRef: ref,
          name: cached?.name,
          tier: cached?.tier,
          food: cached?.foodPreference,
          message: cached ? 'Offline, showing the cached roster.' : 'Offline and not in the cached roster.',
        })
        return
      }
      const next = enqueue(store(), {
        id: `${ref}:${action}`,
        ticketRef: ref,
        action,
        queuedAt: new Date().toISOString(),
      })
      setQueued(next.length)
      setFeedback({
        tone: 'queued',
        ticketRef: ref,
        name: cached?.name,
        tier: cached?.tier,
        food: cached?.foodPreference,
        message: 'Offline. Saved on this device and will send itself when the network comes back.',
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

  const toneClass =
    feedback?.tone === 'ok'
      ? 'scan-ok'
      : feedback?.tone === 'repeat'
        ? 'scan-repeat'
        : feedback?.tone === 'queued'
          ? 'scan-queued'
          : 'scan-problem'

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        {cameraState !== 'running' ? (
          <button type="button" className="cta" onClick={startCamera} disabled={cameraState === 'unsupported'}>
            {cameraState === 'unsupported' ? 'No camera on this device' : 'Start camera'}
          </button>
        ) : (
          <p className="text-step--1 text-muted">Camera running. Point it at the pass.</p>
        )}
        <p role="status" className="text-step--1 text-muted">
          {queued === 0 ? 'Nothing waiting to send' : `${queued} waiting to send`}
        </p>
      </div>

      {cameraState === 'denied' ? (
        <p role="alert" className="text-step--1 text-accent">
          The camera was refused. Use the ticket box below instead.
        </p>
      ) : null}

      <video ref={videoRef} className="scan-video" muted playsInline aria-label="Camera preview" />

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handle(manual, 'lookup')
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="manual-ref" className="text-step--1 text-muted">
            Or type the ticket reference
          </label>
          <input
            id="manual-ref"
            className="field mono"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button type="submit" className="cta-quiet">
          Look up
        </button>
      </form>

      {feedback ? (
        <div className={`scan-card ${toneClass}`} role="status" aria-live="polite">
          <p className="display text-step-4">{feedback.name ?? feedback.ticketRef}</p>
          {feedback.name ? (
            <p className="display text-step-2">
              {feedback.tier} , {feedback.food}
            </p>
          ) : null}
          <p className="mono text-step--1">{feedback.ticketRef}</p>
          <p className="text-step-1">{feedback.message}</p>

          <div className="mt-4 flex flex-wrap gap-4">
            <button type="button" className="cta" onClick={() => void handle(feedback.ticketRef, 'checkin')}>
              Mark checked in
            </button>
            <button
              type="button"
              className="cta-quiet"
              onClick={() => void handle(feedback.ticketRef, 'swag')}
            >
              Mark swag issued
            </button>
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
