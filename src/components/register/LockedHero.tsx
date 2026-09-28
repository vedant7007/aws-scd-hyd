'use client'

import { useRef, useState } from 'react'

/**
 * The closed sign from the v3 handoff's Register.dc.html: a padlock that bobs,
 * shakes when it is poked, and never opens, with a line underneath that keeps
 * talking back. Markup and animation values are the handoff's own.
 */

/** Said in turn after the first poke, round and round. */
const LINES = ['LOCKED. FOR NOW.', 'STILL LOCKED.', 'NOPE. NOT YET.', 'IT IS VERY LOCKED.', 'LEAVE YOUR EMAIL →', 'WE WILL UNLOCK IT FOR YOU.']

export function LockedHero() {
  const [pokes, setPokes] = useState(0)
  const lock = useRef<HTMLButtonElement>(null)

  const poke = () => {
    // Restart the shake from its first frame even mid-shake, then fall back
    // into the bob, exactly as the handoff sequences the two.
    const el = lock.current
    if (el) {
      el.style.animation = 'none'
      void el.offsetWidth
      el.style.animation = 'rg-shake .42s ease-out, rg-bob 3.2s ease-in-out .42s infinite'
    }
    setPokes((n) => n + 1)
  }

  const line = pokes === 0 ? 'REGISTRATION IS LOCKED' : LINES[(pokes - 1) % LINES.length]!

  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px' }}>
      <button
        type="button"
        ref={lock}
        onClick={poke}
        aria-label="Poke the lock"
        style={{ position: 'relative', background: 'transparent', border: '0', padding: '0', cursor: 'pointer', animation: 'rg-bob 3.2s ease-in-out infinite' }}
      >
        <span aria-hidden="true" style={{ display: 'block', position: 'relative', width: 'clamp(200px,40vw,260px)', aspectRatio: '1/1.12' }}>
          <span style={{ position: 'absolute', left: '22%', right: '22%', top: '0', height: '46%', border: 'clamp(18px,3.6vw,24px) solid var(--ink-fill)', borderBottom: '0' }}></span>
          <span style={{ position: 'absolute', left: '0', right: '0', bottom: '0', height: '60%', background: '#FF9900', border: '4px solid var(--line)', boxShadow: '10px 10px 0 var(--line)', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', inset: '0', backgroundImage: 'linear-gradient(rgba(20,22,28,.12) 2px,transparent 2px),linear-gradient(90deg,rgba(20,22,28,.12) 2px,transparent 2px)', backgroundSize: '16px 16px' }}></span>
            <span style={{ position: 'absolute', top: '0', bottom: '0', left: '0', width: '30%', background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0))', animation: 'rg-scan 3.4s ease-in-out infinite' }}></span>
            <span style={{ position: 'absolute', left: '50%', top: '26%', width: '18%', height: '22%', marginLeft: '-9%', background: '#14161C' }}></span>
            <span style={{ position: 'absolute', left: '50%', top: '44%', width: '8%', height: '26%', marginLeft: '-4%', background: '#14161C' }}></span>
          </span>
        </span>
      </button>
      {/* The line is the lock's running commentary, so it is announced politely. */}
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minHeight: '62px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,5.4vw,32px)', lineHeight: '1', color: 'var(--ink)' }}>{line}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {pokes === 0 ? 'Go on, poke it' : `Pokes: ${pokes}`}
        </span>
      </div>
    </section>
  )
}
