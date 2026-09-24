'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The closed sign. A padlock nobody can open, a grid that drifts behind it,
 * and a counter that keeps score of how many times someone tried anyway.
 *
 * The grid is CSS, not canvas: one fixed layer that animates transform only,
 * plus a single cell that snaps to the pointer. Nothing here runs a frame
 * loop, so the page stays cheap on a phone.
 */

/** Said in order, then the last one holds. */
const CAPTIONS = [
  'Locked. Registrations have not opened yet.',
  'Still locked.',
  'Yes, it is really locked.',
  'That is not going to work.',
  'Shaking it does not help.',
  'You are very committed. Respect.',
  'Fine. Leave your email and we will tell you first.',
]

/** The grid pitch, in pixels. Matches --rg-cell in globals.css. */
const CELL = 28

export function LockedHero() {
  const [pokes, setPokes] = useState(0)
  const [shake, setShake] = useState(false)
  const grid = useRef<HTMLDivElement>(null)

  // A cell lights up under the pointer, snapped to the grid. Pointer devices
  // only: a finger has no hover, and a touch would leave a cell lit behind it.
  useEffect(() => {
    const el = grid.current
    if (!el) return
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return

    const onMove = (e: PointerEvent) => {
      el.style.setProperty('--cx', `${Math.floor(e.clientX / CELL) * CELL}px`)
      el.style.setProperty('--cy', `${Math.floor(e.clientY / CELL) * CELL}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const caption = CAPTIONS[Math.min(pokes, CAPTIONS.length - 1)]!

  return (
    <div className="rg-hero">
      <div ref={grid} className="rg-grid" aria-hidden="true">
        <span className="rg-cell" />
      </div>

      <span className="rg-chip">
        <span className="rg-dot" aria-hidden="true" />
        STATUS: LOCKED
      </span>

      <span className="eye">&gt; opening soon_</span>
      <h1 className="rg-h1">
        REGISTRATIONS
        <br />
        OPEN SOON
      </h1>

      <button
        type="button"
        className={`rg-lock${shake ? ' rg-shake' : ''}`}
        aria-label={pokes === 0 ? 'A locked padlock. Try it.' : `Still locked. Tried ${pokes} times.`}
        onClick={() => {
          setPokes((n) => n + 1)
          setShake(true)
        }}
        onAnimationEnd={() => setShake(false)}
      >
        <span className="rg-shackle" aria-hidden="true" />
        <span className="rg-body" aria-hidden="true">
          <span className="rg-keyhole" />
        </span>
      </button>

      {/* The caption is the button's own running commentary, so it is polite:
          a screen reader hears it after whatever it was already saying. */}
      <p className="rg-cap" aria-live="polite">
        {caption}
      </p>
      <p className="rg-pokes">{pokes === 0 ? 'TRY THE LOCK' : `POKES: ${String(pokes).padStart(2, '0')}`}</p>
    </div>
  )
}
