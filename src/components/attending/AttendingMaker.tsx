'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { event, venue } from '@/content/event'
import { siteUrl } from '@/lib/site'

/**
 * The "I'm attending" frame. The photo never leaves the phone: it is drawn
 * onto a canvas over the frame, and the result is downloaded or handed to
 * the share sheet. Nothing is uploaded.
 *
 * The frame is 1024 x 1535 with its photo window at WIN; the photo covers the
 * window, the person drags it and zooms it into place, then the dashed edge
 * the frame had is drawn back on top.
 */
const FRAME = '/assets/attending-frame.jpg'
const W = 1024
const H = 1535
const WIN = { x: 309, y: 621, w: 406, h: 541, r: 22 }
const FILE_NAME = 'im-attending-aws-scd-hyderabad-2026.jpg'

const CAPTION = `I'm attending ${event.name}! 🚀

A full day of cloud and AI with students from across Hyderabad: keynote, technical sessions, hands-on workshops and a panel.

📅 ${event.dateLabel}
📍 ${venue.name}

Join me: ${siteUrl()}

#AWSSCDHyderabad #AWSStudentCommunityDay #AWS #CloudComputing #Hyderabad`

export function AttendingMaker() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [frame, setFrame] = useState<HTMLImageElement | null>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setFrame(img)
    img.src = FRAME
    // Sharing a file works on phones; on most desktops it does not, and the button stays hidden.
    try {
      const probe = new File([new Blob(['x'], { type: 'image/jpeg' })], FILE_NAME, { type: 'image/jpeg' })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanShare(Boolean(navigator.canShare?.({ files: [probe] })))
    } catch {
      setCanShare(false)
    }
  }, [])

  /** How far the photo may move before the window shows an edge. */
  const limits = (img: HTMLImageElement, z: number) => {
    const s = Math.max(WIN.w / img.naturalWidth, WIN.h / img.naturalHeight) * z
    return { s, mx: (img.naturalWidth * s - WIN.w) / 2, my: (img.naturalHeight * s - WIN.h) / 2 }
  }
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !frame) return
    ctx.drawImage(frame, 0, 0, W, H)
    if (!photo) return
    const { s, mx, my } = limits(photo, zoom)
    const dw = photo.naturalWidth * s
    const dh = photo.naturalHeight * s
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(WIN.x, WIN.y, WIN.w, WIN.h, WIN.r)
    ctx.clip()
    ctx.drawImage(photo, WIN.x + (WIN.w - dw) / 2 + clamp(pan.x, mx), WIN.y + (WIN.h - dh) / 2 + clamp(pan.y, my), dw, dh)
    ctx.restore()
    ctx.save()
    ctx.strokeStyle = 'white'
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 3
    ctx.setLineDash([12, 9])
    ctx.beginPath()
    ctx.roundRect(WIN.x + 9, WIN.y + 9, WIN.w - 18, WIN.h - 18, WIN.r - 6)
    ctx.stroke()
    ctx.restore()
  }, [frame, photo, zoom, pan])

  const pick = (file: File | undefined) => {
    if (!file) return
    setNote('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPhoto(img)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
    img.onerror = () => setNote('That photo did not open. Try a JPG or PNG.')
    img.src = url
  }

  /** Canvas pixels per screen pixel, for dragging. */
  const scale = () => W / (canvas.current?.clientWidth || W)

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!photo) return
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !photo) return
    const k = scale()
    const dx = (e.clientX - drag.current.x) * k
    const dy = (e.clientY - drag.current.y) * k
    drag.current = { x: e.clientX, y: e.clientY }
    const { mx, my } = limits(photo, zoom)
    setPan((p) => ({ x: clamp(p.x + dx, mx), y: clamp(p.y + dy, my) }))
  }
  const onUp = () => (drag.current = null)

  const onZoom = (z: number) => {
    setZoom(z)
    if (photo) {
      const { mx, my } = limits(photo, z)
      setPan((p) => ({ x: clamp(p.x, mx), y: clamp(p.y, my) }))
    }
  }

  const blob = () =>
    new Promise<Blob | null>((ok) => {
      if (!canvas.current) return ok(null)
      canvas.current.toBlob(ok, 'image/jpeg', 0.92)
    })

  const download = async () => {
    const b = await blob()
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = FILE_NAME
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const share = async () => {
    const b = await blob()
    if (!b) return
    try {
      await navigator.share({ files: [new File([b], FILE_NAME, { type: 'image/jpeg' })], text: CAPTION })
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(CAPTION).then(() => setCopied(true), () => {})
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="att-stage">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="att-canvas"
          data-ready={photo ? '1' : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="img"
          aria-label={photo ? 'Your I am attending picture' : 'The I am attending frame, waiting for your photo'}
        />
        {!photo ? (
          <button type="button" className="att-add" onClick={() => input.current?.click()}>
            <span className="att-add-plus" aria-hidden="true">+</span>
            ADD YOUR PHOTO
          </button>
        ) : null}
      </div>

      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => (pick(e.currentTarget.files?.[0]), (e.currentTarget.value = ''))} />
      {note ? <p role="alert" className="err-text">{note}</p> : null}

      {photo ? (
        <div className="card flex flex-col gap-3 p-4">
          <label htmlFor="att-zoom" className="lbl">
            Zoom · drag the photo to move it
          </label>
          <input id="att-zoom" type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(Number(e.currentTarget.value))} className="att-range" />
          <button type="button" className="btn btn-sm self-start" onClick={() => input.current?.click()}>
            CHANGE PHOTO
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={download} disabled={!photo}>
          DOWNLOAD
        </button>
        {canShare ? (
          <button type="button" className="btn btn-mint" onClick={share} disabled={!photo}>
            SHARE
          </button>
        ) : null}
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <span className="lbl">Caption to post with it</span>
        <p className="copy whitespace-pre-line">{CAPTION}</p>
        <button type="button" className="btn btn-sm self-start" onClick={copy}>
          {copied ? 'COPIED ✓' : 'COPY CAPTION'}
        </button>
      </div>

      <p className="hint">Your photo stays on your phone. Nothing is uploaded to us. On LinkedIn and Instagram, post the downloaded picture and paste the caption.</p>
    </div>
  )
}
