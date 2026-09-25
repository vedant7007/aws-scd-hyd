'use client'

import { useState } from 'react'

/**
 * The closed sign: a padlock nobody can open, and a caption that keeps score
 * of how many times someone tried anyway. The grid behind it is DriftGrid,
 * which has to sit outside .page.rise to anchor to the viewport.
 */

/** Said in order, then the last one holds. */
const CAPTIONS = [
  'REGISTRATION IS LOCKED',
  'STILL LOCKED',
  'YES, REALLY LOCKED',
  'THAT WILL NOT WORK',
  'SHAKING DOES NOT HELP',
  'VERY COMMITTED. RESPECT.',
  'FINE. LEAVE YOUR EMAIL.',
]

export function LockedHero() {
  const [pokes, setPokes] = useState(0)
  const [shake, setShake] = useState(false)

  const caption = CAPTIONS[Math.min(pokes, CAPTIONS.length - 1)]!

  return (
    <div className="rg-side">
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
        <span className="rg-pix" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

      {/* The caption is the button's own running commentary, so it is polite:
          a screen reader hears it after whatever it was already saying. */}
      <p className="rg-cap" aria-live="polite">
        {caption}
      </p>
      <p className="rg-pokes">{pokes === 0 ? 'GO ON, POKE IT' : `POKES: ${String(pokes).padStart(2, '0')}`}</p>
    </div>
  )
}
