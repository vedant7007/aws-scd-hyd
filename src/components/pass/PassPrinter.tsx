'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * The ticket printer, pixel style. The first time someone opens their pass
 * link a little console waits with a red light and a big button. A tap boots
 * it: the screen types its checks, a block bar fills, the light goes green and
 * the real pass prints out of the slot with a chiptune tick. Then pixel
 * confetti, a VERIFIED stamp, and the ticket floats on its own with Share
 * under it. Every later visit (the gate, a second look) shows the ticket at
 * once: the print is remembered on the device. Reduced motion skips it.
 */
type Stage = 'boot' | 'idle' | 'warm' | 'printing' | 'done'

const BOOT_LINES = ['VERIFYING PAYMENT', 'LOADING YOUR SESSIONS', 'WARMING THE PRINTER']
const LINE_MS = 520
const PRINT_MS = 2800
const CONFETTI = Array.from({ length: 34 }, (_, i) => i)
const COLOURS = ['var(--orange)', 'var(--mint-fill)', 'var(--violet-fill)', 'var(--pink-fill)', 'var(--gold-fill)']

/** A tiny square wave synth: chiptune blips, no files. Silent where audio is not allowed. */
function useBleeps() {
  const ctx = useRef<AudioContext | null>(null)
  return (notes: [number, number][], type: OscillatorType = 'square', gain = 0.035) => {
    try {
      ctx.current ??= new AudioContext()
      const c = ctx.current
      let t = c.currentTime
      for (const [freq, len] of notes) {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = type
        o.frequency.value = freq
        g.gain.setValueAtTime(gain, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + len)
        o.connect(g).connect(c.destination)
        o.start(t)
        o.stop(t + len)
        t += len * 0.9
      }
    } catch {
      // No sound here; the screen still tells the story.
    }
  }
}

export function PassPrinter({ passId, shareText, children }: { passId: string; shareText: string; children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('boot')
  /** The "open your ticket?" prompt over the page on a first visit. Dismissing it leaves the printer waiting. */
  const [ask, setAsk] = useState(false)
  const [lines, setLines] = useState(0)
  const [shared, setShared] = useState('')
  /** Printed on this visit, so the confetti plays now and not on every later look. */
  const [fresh, setFresh] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const bleep = useBleeps()
  const key = `scd.printed.${passId}`

  useEffect(() => {
    let printed = false
    try {
      printed = localStorage.getItem(key) === '1'
    } catch {
      // Storage blocked: show the printer, it still works.
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Storage only exists after hydration, so this cannot be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage(printed || reduce ? 'done' : 'idle')
    setAsk(!printed && !reduce && !window.location.hash)
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [key])

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))

  const print = () => {
    setAsk(false)
    if (stage !== 'idle') return
    setStage('warm')
    setLines(0)
    try {
      navigator.vibrate?.(30)
    } catch {
      // No buzz on this device.
    }
    bleep([[523, 0.08], [784, 0.1]])
    root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    BOOT_LINES.forEach((_, i) =>
      later(LINE_MS * (i + 1), () => {
        setLines(i + 1)
        bleep([[660 + i * 110, 0.06]])
      }),
    )
    const startPrint = LINE_MS * (BOOT_LINES.length + 1)
    later(startPrint, () => setStage('printing'))
    for (let t = 0; t < PRINT_MS; t += 220) later(startPrint + t, () => bleep([[180 + (t % 3) * 30, 0.03]], 'square', 0.02))
    later(startPrint + PRINT_MS, () => {
      setStage('done')
      setFresh(true)
      bleep([[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.22]], 'square', 0.04)
      try {
        navigator.vibrate?.([40, 40, 80])
        localStorage.setItem(key, '1')
      } catch {
        // Not remembered: it prints again next time, which is fine.
      }
      later(250, () => root.current?.querySelector('.pp-out')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    })
  }

  // The public "I'm attending" card, never this page: the ticket link is the ticket.
  const share = async () => {
    const url = `${window.location.origin}/pass/${passId}/share`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My ticket', text: shareText, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShared('LINK COPIED ✓')
    } catch {
      // Share sheet closed: nothing to do.
    }
  }

  const screen =
    stage === 'idle'
      ? ['READY.', 'PRESS THE BUTTON']
      : stage === 'warm'
        ? BOOT_LINES.slice(0, lines).map((l) => `${l} ✓`).concat(lines < BOOT_LINES.length ? [`${BOOT_LINES[lines]}…`] : [])
        : stage === 'printing'
          ? ['ALL CHECKS ✓', `PRINTING ${passId}`]
          : ['DONE. SEE YOU THERE!']
  const progress = stage === 'warm' ? lines / BOOT_LINES.length : stage === 'printing' || stage === 'done' ? 1 : 0

  return (
    <div ref={root} className="pp" data-stage={stage}>
      {/* On <body>: the page's entrance animation transforms its wrapper, which would trap a fixed overlay inside it. */}
      {ask && stage === 'idle' ? createPortal(
        <div className="pp-ask" role="dialog" aria-modal="true" aria-labelledby="pp-ask-h">
          <div className="pp-ask-card">
            <span className="pp-ask-tag">🎟 YOUR TICKET IS READY</span>
            <span id="pp-ask-h" className="pp-ask-h">
              OPEN YOUR
              <br />
              TICKET?
            </span>
            <button type="button" className="btn btn-primary btn-lg" onClick={print} autoFocus>
              YES, PRINT IT ▸
            </button>
            <button type="button" className="pp-again" onClick={() => setAsk(false)}>
              not now
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      <div className="pp-printer" aria-hidden={stage === 'done'}>
        <div className="pp-body">
          <span className="pp-sparks" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
          <div className="pp-head">
            <span className="pp-leds" aria-hidden="true">
              <span className="pp-led" />
              <span className="pp-led pp-led-2" />
              <span className="pp-led pp-led-3" />
            </span>
            <span className="pp-brand">SCD.HYD26 · PASS-O-MATIC</span>
          </div>
          <div className="pp-screen" role="status" aria-live="polite">
            {screen.map((l, i) => (
              <span key={`${stage}-${i}`} className="pp-line">
                {'> '}
                {l}
              </span>
            ))}
            <span className="pp-cursor" aria-hidden="true" />
            <span className="pp-bar" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} data-on={i < Math.round(progress * 12) ? '1' : undefined} />
              ))}
            </span>
          </div>
          <button type="button" className="pp-btn" onClick={print} disabled={stage !== 'idle'} aria-label="Print my ticket">
            <span className="pp-btn-ring" aria-hidden="true" />
            <svg className="pp-btn-icon" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
              <path d="M6 1h2v1H6zM5 2h1v6H5zM8 2h1v4H8zM9 5h2v1H9zM11 6h2v1h-2zM13 7h1v4h-1zM12 11h1v2h-1zM11 13h1v1h-1zM5 14h6v1H5zM4 13h1v1H4zM3 11h1v2H3zM2 9h1v2H2zM3 8h2v1H3z" fill="currentColor" />
              <path d="M6 2h2v5h1V6h2v1h2v4h-1v2h-1v1H5v-1H4v-2H3V9h2V2z" fill="currentColor" opacity=".18" />
            </svg>
          </button>
          <span className="pp-tap">{stage === 'idle' ? 'TAP TO PRINT YOUR TICKET' : stage === 'warm' ? 'BOOTING…' : 'PRINTING…'}</span>
        </div>
        <div className="pp-slot" />
      </div>

      <div className="pp-out">
        <div className="pp-paper">
          {children}
          <span className="pp-stamp" aria-hidden="true">
            ✓ VERIFIED
          </span>
        </div>
        <span className="pp-glow" aria-hidden="true" />
      </div>

      {fresh ? (
        <span className="pp-confetti" aria-hidden="true">
        {CONFETTI.map((i) => (
          <span
            key={i}
            style={
              {
                '--x': `${((i * 37) % 100) - 50}vw`,
                '--d': `${(i % 7) * 70}ms`,
                '--r': `${(i % 4) * 90}deg`,
                '--c': COLOURS[i % COLOURS.length],
              } as CSSProperties
            }
          />
        ))}
        </span>
      ) : null}

      <div className="pp-after">
        <button type="button" className="btn btn-primary btn-lg" onClick={share}>
          {shared || 'SHARE TICKET'}
        </button>
        <button
          type="button"
          className="pp-again"
          onClick={() => {
            try {
              localStorage.removeItem(key)
            } catch {
              // Nothing remembered to forget.
            }
            setStage('idle')
          }}
        >
          print it again
        </button>
      </div>
    </div>
  )
}
