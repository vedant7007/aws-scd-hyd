'use client'

import Link from 'next/link'
import { useEffect, useRef, type CSSProperties } from 'react'
import { passes } from '@/content/passes'
import type { Tier } from '@/lib/db/types'

/**
 * The four passes, drawn as the metal each one is named after: copper, gold,
 * platinum and diamond. The perk lists come from content/passes.ts so the
 * cards, the notify page and the parked checkout can never disagree about
 * what a pass is.
 *
 * Every perk is written out in full on every card. Deliberately not
 * "everything in Regular": someone comparing four cards should not have to
 * hold another card in their head.
 *
 * The metals are the same in both themes. They are fills carrying dark ink,
 * like --peach and --gold-fill, so a card reads the same on the light ground
 * and the dark one and the ink never has to be re-checked per theme.
 */

type Look = {
  /** The metal's own name, printed above the tier name. */
  metal: string
  fill: string
  edge: string
  /** Ink for the name, the perks and the lit squares. A dark tint of the metal. */
  ink: string
  /** How many of the four squares are lit. */
  filled: number
  spark: string
}

const LOOK: Record<Tier, Look> = {
  basic: {
    metal: 'COPPER',
    fill: 'linear-gradient(145deg,#E9A97E 0%,#F7DDC9 17%,#DD9363 41%,#FBEADC 60%,#E5A276 81%,#D2864F 100%)',
    edge: '#A7643A',
    ink: '#3B1F0B',
    filled: 1,
    spark: '#F7DDC9',
  },
  premium: {
    metal: 'GOLD',
    fill: 'linear-gradient(145deg,#E7B443 0%,#FCEB9B 17%,#D79F20 41%,#FFF7C9 60%,#E3B337 81%,#C39012 100%)',
    edge: '#A8801A',
    ink: '#3A2A05',
    filled: 2,
    spark: '#FFF7C9',
  },
  ultra: {
    metal: 'PLATINUM',
    fill: 'linear-gradient(145deg,#C6CBD4 0%,#F4F6F9 17%,#A9B1BC 41%,#FCFDFE 60%,#C2C8D1 81%,#959DAA 100%)',
    edge: '#7E8794',
    ink: '#171B22',
    filled: 3,
    spark: '#FCFDFE',
  },
  vip: {
    metal: 'DIAMOND',
    // A ray burst off the top right corner over the iridescence, which is what
    // makes this one read as a gem rather than a fourth sheet of metal.
    fill:
      'repeating-conic-gradient(from 200deg at 86% 6%, rgba(255,255,255,.5) 0deg 2.4deg, transparent 2.4deg 8deg),' +
      'linear-gradient(145deg,#BFE9CC 0%,#F3F2CA 24%,#C3E2F4 48%,#EACBE9 73%,#C9EBD8 100%)',
    edge: '#7FB9A6',
    ink: '#10231C',
    filled: 4,
    spark: '#FFFFFF',
  },
}

/** Ink for anything sitting on the dark blocks: the price, the button, the badge. */
const HARD = '#14161C'
const ON_HARD = '#F4F7FB'

/** Fixed positions, so the twinkle never lands on the price or the button. */
const SPARKS = [
  { top: '12%', left: '8%', s: '10px', d: '3.2s', y: '0s' },
  { top: '30%', left: '84%', s: '8px', d: '4.1s', y: '.7s' },
  { top: '58%', left: '6%', s: '9px', d: '3.6s', y: '1.5s' },
  { top: '70%', left: '90%', s: '11px', d: '4.6s', y: '2.2s' },
  { top: '44%', left: '93%', s: '7px', d: '5.2s', y: '1.1s' },
  { top: '86%', left: '14%', s: '8px', d: '3.9s', y: '3s' },
]

export function PassCards({ prices, cta }: { prices: Record<Tier, { list: string | null; early: string | null }>; cta: string }) {
  const root = useRef<HTMLDivElement>(null)

  /**
   * Sparks on hover, spawned as fixed-position nodes and animated with WAAPI
   * so they are never part of layout and never survive their own animation.
   * Pointer devices only, and never under reduced motion.
   */
  useEffect(() => {
    const el = root.current
    if (!el) return
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onEnter = (ev: Event) => {
      const card = (ev.target as HTMLElement).closest<HTMLElement>('[data-pass]')
      if (!card) return
      const r = card.getBoundingClientRect()
      const tint = getComputedStyle(card).getPropertyValue('--spark').trim() || '#FF9900'
      for (let i = 0; i < 30; i++) {
        const s = document.createElement('span')
        const star = i % 5 === 0
        s.textContent = star ? '✦' : ''
        const edge = Math.random()
        const x = r.left + (edge < 0.5 ? Math.random() * r.width : Math.random() < 0.5 ? 0 : r.width)
        const y = r.top + (edge < 0.5 ? (Math.random() < 0.5 ? 0 : r.height) : Math.random() * r.height)
        Object.assign(s.style, {
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          width: star ? 'auto' : '4px',
          height: star ? 'auto' : '4px',
          fontSize: star ? '11px' : '0',
          lineHeight: '1',
          color: tint,
          background: star ? 'transparent' : tint,
          pointerEvents: 'none',
          zIndex: '60',
        })
        document.body.appendChild(s)
        const a = s.animate(
          [
            { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
            { transform: `translate3d(${(Math.random() - 0.5) * 150}px,${(Math.random() - 0.5) * 150}px,0) scale(0)`, opacity: 0 },
          ],
          { duration: 650 + Math.random() * 450, easing: 'cubic-bezier(.2,.7,.3,1)' },
        )
        a.onfinish = () => s.remove()
        a.oncancel = () => s.remove()
      }
    }

    const onMove = (ev: PointerEvent) => {
      const card = (ev.target as HTMLElement).closest<HTMLElement>('[data-pass]')
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--px', `${ev.clientX - r.left}px`)
      card.style.setProperty('--py', `${ev.clientY - r.top}px`)
    }

    el.addEventListener('pointerenter', onEnter, true)
    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('pointerenter', onEnter, true)
      el.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div ref={root} data-grid4="1" style={{ display: 'grid', gap: 'clamp(16px,2.2vw,24px)', alignItems: 'stretch' }}>
      {passes.map((p) => {
        const look = LOOK[p.id]
        const price = prices[p.id]
        return (
          <article
            key={p.id}
            data-rv="1"
            data-pass={p.id}
            className="pass-card pass-metal lp-hv-foil"
            style={
              {
                '--spark': look.spark,
                background: look.fill,
                border: `3px solid ${look.edge}`,
                borderRadius: '0',
                boxShadow: '8px 8px 0 rgba(5,7,12,.5)',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minHeight: '360px',
                position: 'relative',
              } as CSSProperties
            }
          >
            {/* The sheen that crosses the face every few seconds. */}
            <span className="pass-shine" aria-hidden="true" />
            <span className="pass-glow" aria-hidden="true" />

            <span style={{ position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
              {SPARKS.map((k, n) => (
                <span
                  key={n}
                  style={{ position: 'absolute', top: k.top, left: k.left, color: look.spark, fontSize: k.s, lineHeight: '1', animation: `bm-spark ${k.d} steps(4) ${k.y} infinite` }}
                >
                  ✦
                </span>
              ))}
            </span>

            {p.id === 'vip' ? (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: HARD,
                  color: ON_HARD,
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  padding: '6px 10px',
                  zIndex: '2',
                }}
              >
                <span style={{ color: 'var(--gold-fill)' }}>◆</span> TOP TIER
              </span>
            ) : null}

            <div style={{ position: 'relative', zIndex: '1', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', paddingTop: p.id === 'vip' ? '18px' : '0' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.22em', color: look.ink, opacity: '.72' }}>{look.metal}</span>
                {/* Engraved, not foil-filled: a gradient clipped to text washes
                    out on a light metal, and this has to hold AA on all four. */}
                <h3
                  style={{
                    margin: '0',
                    fontFamily: 'var(--font-display)',
                    fontSize: '30px',
                    lineHeight: '1',
                    color: look.ink,
                    textShadow: '0 1px 0 rgba(255,255,255,.55)',
                  }}
                >
                  {p.name.toUpperCase()}
                </h3>
              </span>
              {/* The tier meter: lit squares out of four. */}
              <span style={{ display: 'flex', gap: '4px', flex: 'none', marginTop: '14px' }} aria-hidden="true">
                {[0, 1, 2, 3].map((n) => (
                  <span
                    key={n}
                    style={{
                      width: '11px',
                      height: '11px',
                      boxSizing: 'border-box',
                      background: n < look.filled ? look.ink : 'transparent',
                      border: `2px solid ${look.ink}`,
                    }}
                  />
                ))}
              </span>
            </div>

            <span
              style={{
                position: 'relative',
                zIndex: '1',
                fontFamily: 'var(--font-mono)',
                fontSize: '26px',
                color: ON_HARD,
                background: HARD,
                alignSelf: 'flex-start',
                padding: '5px 12px',
              }}
            >
              {price.early && price.list ? (
                <>
                  <s style={{ opacity: '.55', marginRight: '.4em' }}>{price.list}</s>
                  {price.early}
                </>
              ) : (
                (price.list ?? 'Announced soon')
              )}
            </span>

            <ul
              style={{
                position: 'relative',
                zIndex: '1',
                margin: '0',
                padding: '0',
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
                fontSize: '14px',
                lineHeight: '1.45',
                color: look.ink,
              }}
            >
              {p.perks.map((perk) => (
                <li key={perk}>+ {perk}</li>
              ))}
            </ul>

            <Link
              href="/register"
              className="lp-ac-press"
              style={{
                position: 'relative',
                zIndex: '1',
                marginTop: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '52px',
                fontFamily: 'var(--font-display)',
                fontSize: '19px',
                background: HARD,
                color: ON_HARD,
                borderBottom: `4px solid ${look.edge}`,
                cursor: 'pointer',
              }}
            >
              {cta}
            </Link>
          </article>
        )
      })}
    </div>
  )
}
