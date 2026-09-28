'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { event } from '@/content/event'

/**
 * The secret launch page. Hyderabad at night in pixels, a five second
 * countdown over a chiptune synth, then the sun comes up over the Charminar
 * and the confetti goes off.
 *
 * Everything is drawn in the canvas. There is no image, no video and no audio
 * file to ship, so the page cannot break because an asset is missing.
 *
 * The synth is built on the LAUNCH click, never before. An AudioContext made
 * without a user gesture starts suspended, and browsers are right to do that.
 */

type Phase = 'idle' | 'counting' | 'rising' | 'done'

const COUNT_FROM = 5
/** How long the sun takes to clear the skyline. */
const RISE_MS = 5200

/* --- the synth ------------------------------------------------------------
   Square waves for the countdown, triangles for the sunrise. Everything is
   scheduled against the context clock rather than setTimeout, so the beeps do
   not drift under load. */

type Synth = {
  blip: (freq: number, at: number, dur: number, gain?: number) => void
  swell: (at: number, dur: number) => void
  fanfare: (at: number) => void
  now: () => number
  close: () => void
}

function makeSynth(): Synth | null {
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const ctx = new Ctor()
  const out = ctx.createGain()
  out.gain.value = 0.5
  out.connect(ctx.destination)

  const blip: Synth['blip'] = (freq, at, dur, gain = 0.16) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.setValueAtTime(freq, at)
    // A hard attack and an exponential tail: the shape a 1-bit channel makes.
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + dur + 0.02)
  }

  /** The sunrise pad: a chord that opens up as the light does. */
  const swell: Synth['swell'] = (at, dur) => {
    const chord = [130.81, 196, 261.63, 329.63, 392]
    chord.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(f, at)
      const peak = 0.075 - i * 0.008
      const inAt = at + i * (dur * 0.12)
      g.gain.setValueAtTime(0.0001, inAt)
      g.gain.exponentialRampToValueAtTime(peak, inAt + dur * 0.35)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      o.connect(g).connect(out)
      o.start(inAt)
      o.stop(at + dur + 0.05)
    })
  }

  // A major arpeggio up, then the octave held. Plain, and it lands.
  const fanfare: Synth['fanfare'] = (at) => {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => blip(f, at + i * 0.09, 0.1, 0.14))
    blip(1046.5, at + 0.42, 0.5, 0.12)
    blip(1567.98, at + 0.42, 0.5, 0.07)
  }

  return { blip, swell, fanfare, now: () => ctx.currentTime, close: () => void ctx.close() }
}

/* --- the city -------------------------------------------------------------
   Drawn with fillRect on integer coordinates only, so it stays pixel art at
   any size rather than turning into soft shapes. */

type Building = { x: number; w: number; h: number; lit: boolean[] }
type Star = { x: number; y: number; p: number }

const WIN = 6
const GAP = 5

/** Sky stops at night, at first light and at full morning. Lerped between. */
const SKY = [
  ['#05070C', '#101A2E', '#1D2942'],
  ['#241A3C', '#7C3F5C', '#E8845C'],
  ['#3E9BDE', '#9ED3F2', '#FBE7BE'],
] as const

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

function mix(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i]!, k))).join(',')})`
}

/** Pick a sky stop for `dawn` in 0..1, crossing night -> first light -> morning. */
function skyAt(row: number, dawn: number) {
  const k = dawn < 0.5 ? dawn * 2 : (dawn - 0.5) * 2
  const from = dawn < 0.5 ? SKY[0][row] : SKY[1][row]
  const to = dawn < 0.5 ? SKY[1][row] : SKY[2][row]
  return mix(from, to, k)
}

/** The Charminar stands in a cleared plaza, centred, with the sun behind it. */
const PLAZA_AT = 0.5
const PLAZA_W = 0.26

function buildCity(w: number, h: number): { blocks: Building[]; stars: Star[] } {
  const blocks: Building[] = []
  const plaza = [w * (PLAZA_AT - PLAZA_W / 2), w * (PLAZA_AT + PLAZA_W / 2)]
  let x = -20
  while (x < w + 20) {
    const bw = 40 + Math.floor(Math.random() * 60)
    const bh = Math.floor(h * (0.14 + Math.random() * 0.34))
    const cols = Math.max(1, Math.floor((bw - GAP) / (WIN + GAP)))
    const rows = Math.max(1, Math.floor((bh - GAP) / (WIN + GAP)))
    // Anything that would wall in the plaza is simply not built.
    if (x + bw > plaza[0]! && x < plaza[1]!) {
      x = plaza[1]! + Math.floor(Math.random() * 8)
      continue
    }
    blocks.push({ x, w: bw, h: bh, lit: Array.from({ length: cols * rows }, () => Math.random() < 0.38) })
    x += bw + 3 + Math.floor(Math.random() * 10)
  }
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.58, p: Math.random() }))
  return { blocks, stars }
}

/**
 * The Charminar: a square base with four arches, four corner minarets with
 * banded tiers and bulbous domes. Blocked out rather than traced, because the
 * whole page is on a pixel grid.
 */
function drawCharminar(c: CanvasRenderingContext2D, cx: number, ground: number, s: number, fill: string) {
  const px = (a: number, b: number, w: number, h: number, f = fill) => {
    c.fillStyle = f
    c.fillRect(Math.round(cx + a * s), Math.round(ground + b * s), Math.ceil(w * s), Math.ceil(h * s))
  }
  // Plinth and main block.
  px(-15, -12, 30, 12)
  px(-13, -26, 26, 14)
  // Four arch openings punched back out of the block.
  const sky = c.fillStyle
  void sky
  for (const ax of [-10.5, 1.5]) {
    c.fillStyle = 'rgba(0,0,0,.55)'
    c.fillRect(Math.round(cx + ax * s), Math.round(ground - 10 * s), Math.ceil(9 * s), Math.ceil(10 * s))
    c.fillStyle = 'rgba(0,0,0,.55)'
    c.fillRect(Math.round(cx + (ax + 1) * s), Math.round(ground - 13 * s), Math.ceil(7 * s), Math.ceil(4 * s))
  }
  // Balcony band, then the upper storey.
  px(-15, -30, 30, 4)
  px(-9, -40, 18, 10)
  px(-11, -44, 22, 4)
  // Central dome.
  px(-4, -49, 8, 5)
  px(-2, -52, 4, 3)
  // Four minarets, the outer pair read as the front two.
  for (const mx of [-15, 11]) {
    px(mx, -44, 4, 32)
    px(mx - 1, -50, 6, 3)
    px(mx - 0.5, -55, 5, 5)
    px(mx + 0.5, -59, 3, 4)
    px(mx + 1, -62, 1, 3)
  }
  for (const mx of [-11, 7]) {
    px(mx, -40, 3.5, 14)
    px(mx - 0.5, -45, 4.5, 3)
    px(mx, -49, 3.5, 4)
  }
}

function drawScene(c: CanvasRenderingContext2D, w: number, h: number, city: ReturnType<typeof buildCity>, t: number, dawn: number) {
  const sky = c.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, skyAt(0, dawn))
  sky.addColorStop(0.62, skyAt(1, dawn))
  sky.addColorStop(1, skyAt(2, dawn))
  c.fillStyle = sky
  c.fillRect(0, 0, w, h)

  const ground = Math.round(h * 0.88)
  const night = Math.max(0, 1 - dawn * 1.8)

  // Stars and the moon fade as the sky comes up.
  if (night > 0.02) {
    for (const s of city.stars) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.0016 + s.p * 9))
      c.fillStyle = `rgba(244,247,251,${(0.25 + s.p * 0.6) * tw * night})`
      c.fillRect(Math.round(s.x), Math.round(s.y), 2, 2)
    }
    c.fillStyle = `rgba(244,247,251,${night})`
    const mx = Math.round(w * 0.84)
    const my = Math.round(h * 0.14)
    for (let dy = -18; dy <= 18; dy += 3) {
      const half = Math.round(Math.sqrt(Math.max(0, 18 * 18 - dy * dy)) / 3) * 3
      c.fillRect(mx - half, my + dy, half * 2, 3)
    }
  }

  // The sun climbs from under the skyline to a third of the way up.
  if (dawn > 0) {
    const sx = Math.round(w * (PLAZA_AT - 0.075))
    const sy = Math.round(ground + 60 - dawn * (ground * 0.62))
    const r = Math.max(26, Math.round(w / 22))
    const glow = c.createRadialGradient(sx, sy, 0, sx, sy, r * 6)
    glow.addColorStop(0, `rgba(255,190,90,${0.5 * dawn})`)
    glow.addColorStop(1, 'rgba(255,190,90,0)')
    c.fillStyle = glow
    c.fillRect(0, 0, w, ground)
    c.fillStyle = mix('#FF8A3C', '#FFE9A8', Math.min(1, dawn * 1.3))
    const step = Math.max(3, Math.round(r / 7))
    for (let dy = -r; dy <= r; dy += step) {
      const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) / step) * step
      c.fillRect(sx - half, sy + dy, half * 2, step)
    }
  }

  // Silhouettes warm from near black to a hazy morning grey.
  const body = mix('#0A1020', '#4A5570', Math.max(0, dawn - 0.25) / 0.75)
  const rim = dawn > 0.45 ? mix('#FF9900', '#FFE9A8', (dawn - 0.45) / 0.55) : null

  for (const b of city.blocks) {
    const top = ground - b.h
    c.fillStyle = body
    c.fillRect(Math.round(b.x), top, b.w, b.h)
    if (rim) {
      c.fillStyle = rim
      c.fillRect(Math.round(b.x), top, b.w, 2)
    }
    const cols = Math.max(1, Math.floor((b.w - GAP) / (WIN + GAP)))
    // Windows go out as the sun comes up, the way a city actually wakes.
    const lit = Math.max(0, 1 - dawn * 1.5)
    if (lit > 0.02) {
      for (let i = 0; i < b.lit.length; i++) {
        if (!b.lit[i]) continue
        const wx = Math.round(b.x) + GAP + (i % cols) * (WIN + GAP)
        const wy = top + GAP + Math.floor(i / cols) * (WIN + GAP)
        if (wy > ground - WIN) break
        c.fillStyle = `rgba(246,210,122,${0.68 * lit})`
        c.fillRect(wx, wy, WIN, WIN)
      }
    }
  }

  drawCharminar(c, w * PLAZA_AT, ground, Math.max(2.2, w / 190), mix('#080D18', '#3C4560', Math.max(0, dawn - 0.2) / 0.8))

  c.fillStyle = mix('#05070C', '#2E3852', Math.max(0, dawn - 0.3) / 0.7)
  c.fillRect(0, ground, w, h - ground)
}

export function LaunchSequence() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(COUNT_FROM)
  const canvas = useRef<HTMLCanvasElement>(null)
  const synth = useRef<Synth | null>(null)
  const burst = useRef<HTMLDivElement>(null)
  // The loop reads these rather than closing over state, so it is started once.
  const phaseRef = useRef<Phase>('idle')
  const riseAt = useRef(0)

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* One loop for the whole page, started on mount and stopped on unmount.
     Under reduced motion it paints a single still frame instead. */
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const c = cv.getContext('2d')
    if (!c) return

    let city = buildCity(1, 1)
    let raf = 0
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.imageSmoothingEnabled = false
      city = buildCity(w, h)
    }
    resize()

    const frame = (t: number) => {
      const p = phaseRef.current
      const k = p === 'rising' ? Math.min(1, (performance.now() - riseAt.current) / RISE_MS) : p === 'done' ? 1 : 0
      // Eased, so first light creeps and then the sun clears the roofline.
      drawScene(c, w, h, city, t, k * k * (3 - 2 * k))
      raf = requestAnimationFrame(frame)
    }

    if (reduced()) drawScene(c, w, h, city, 0, 0)
    else raf = requestAnimationFrame(frame)

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => () => synth.current?.close(), [])

  /** Confetti, as nodes that never join layout and never outlive their animation. */
  const confetti = useCallback(() => {
    const host = burst.current
    if (!host || reduced()) return
    const tints = ['#FF9900', '#9FE3B6', '#C4AEF2', '#F2A7C3', '#F6D27A', '#54B8FF']
    for (let i = 0; i < 140; i++) {
      const s = document.createElement('i')
      const size = 5 + Math.random() * 7
      Object.assign(s.style, {
        position: 'absolute',
        left: `${50 + (Math.random() - 0.5) * 24}%`,
        top: '52%',
        width: `${size}px`,
        height: `${size}px`,
        background: tints[i % tints.length]!,
        pointerEvents: 'none',
      })
      host.appendChild(s)
      const a = s.animate(
        [
          { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 1 },
          {
            transform: `translate3d(${(Math.random() - 0.5) * 900}px,${-120 - Math.random() * 380}px,0) rotate(${Math.random() * 900}deg)`,
            opacity: 1,
            offset: 0.45,
          },
          { transform: `translate3d(${(Math.random() - 0.5) * 1100}px,${420 + Math.random() * 380}px,0) rotate(${Math.random() * 1400}deg)`, opacity: 0 },
        ],
        { duration: 2200 + Math.random() * 1400, easing: 'cubic-bezier(.2,.6,.35,1)' },
      )
      a.onfinish = () => s.remove()
      a.oncancel = () => s.remove()
    }
  }, [])

  const start = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    synth.current ??= makeSynth()
    const s = synth.current
    const t0 = s?.now() ?? 0

    setPhase('counting')
    phaseRef.current = 'counting'
    setCount(COUNT_FROM)

    // One beep per second, rising, then the pad under the sunrise.
    for (let i = 0; i < COUNT_FROM; i++) s?.blip(330 + i * 55, t0 + i, 0.14)
    s?.swell(t0 + COUNT_FROM, RISE_MS / 1000)

    for (let i = 1; i <= COUNT_FROM; i++) {
      window.setTimeout(() => setCount(COUNT_FROM - i), i * 1000)
    }

    window.setTimeout(() => {
      setPhase('rising')
      phaseRef.current = 'rising'
      riseAt.current = performance.now()
    }, COUNT_FROM * 1000)

    window.setTimeout(
      () => {
        setPhase('done')
        phaseRef.current = 'done'
        s?.fanfare(s.now())
        confetti()
      },
      COUNT_FROM * 1000 + RISE_MS,
    )
  }, [confetti])

  return (
    <div className="lx-wrap">
      <canvas ref={canvas} className="lx-canvas" aria-hidden="true" />
      <div ref={burst} className="lx-burst" aria-hidden="true" />

      <div className="lx-ui">
        {phase === 'idle' ? (
          <>
            <span className="lx-eye">{'// restricted'}</span>
            <h1 className="lx-h1">LAUNCH CONTROL</h1>
            <p className="lx-copy">Five seconds, then the sun comes up over Hyderabad. Turn the sound up.</p>
            <button type="button" className="lx-btn" onClick={start}>
              LAUNCH
            </button>
          </>
        ) : null}

        {phase === 'counting' ? (
          <div className="lx-count" role="timer" aria-live="assertive" aria-label={`T minus ${count}`}>
            {count === 0 ? 'GO' : count}
          </div>
        ) : null}

        {phase === 'done' ? (
          <div className="lx-done">
            <span className="lx-eye">{'// good morning, hyderabad'}</span>
            <h1 className="lx-h1">
              SCD.HYD 26
              <br />
              <span>IS GO</span>
            </h1>
            <p className="lx-copy">{event.dateLabel}. See you there.</p>
            <Link href="/" className="lx-btn">
              BACK TO THE EVENT
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
