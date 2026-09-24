'use client'

import Link from 'next/link'
import { useEffect, useRef, type CSSProperties } from 'react'
import { passes } from '@/content/passes'
import type { Tier } from '@/lib/db/types'

/**
 * The four passes. Copper, gold, platinum and diamond, as the handoff draws
 * them; the perk lists come from content/passes.ts so the cards, the notify
 * page and the parked checkout can never disagree about what a pass is.
 *
 * Every perk is written out in full on every card. Deliberately not
 * "everything in Regular": someone comparing four cards should not have to
 * hold another card in their head.
 */

type Look = {
  border: string
  dots: [string, string, string, string]
  priceBg: string
  priceInk: string
  body: string
  btn: 'mint' | 'pink' | 'gold'
  card?: CSSProperties
}

const LOOK: Record<Tier, Look> = {
  basic: {
    border: '3px solid var(--line)',
    dots: ['#9FE3B6', 'var(--bar)', 'var(--bar)', 'var(--bar)'],
    priceBg: 'var(--ink-fill)',
    priceInk: 'var(--bg)',
    body: 'var(--body)',
    btn: 'mint',
  },
  premium: {
    border: '3px solid var(--line)',
    dots: ['#FF9900', '#FF9900', 'var(--bar)', 'var(--bar)'],
    priceBg: 'var(--ink-fill)',
    priceInk: 'var(--bg)',
    body: 'var(--body)',
    btn: 'mint',
  },
  ultra: {
    border: '3px solid var(--line)',
    dots: ['#F2A7C3', '#F2A7C3', '#F2A7C3', 'var(--bar)'],
    priceBg: 'var(--ink-fill)',
    priceInk: 'var(--bg)',
    body: 'var(--body)',
    btn: 'pink',
  },
  vip: {
    border: '4px solid var(--gold)',
    dots: ['#9FE3B6', '#FF9900', '#C4AEF2', 'var(--ink-fill)'],
    priceBg: 'var(--gold)',
    priceInk: 'var(--on-fill)',
    body: 'var(--body-gold)',
    btn: 'gold',
    card: { background: 'var(--panel-gold)', boxShadow: '8px 8px 0 var(--line-soft)' },
  },
}

const BTN: Record<Look['btn'], { style: CSSProperties; className: string }> = {
  mint: {
    style: { border: '3px solid #9FE3B6', color: 'var(--ink)', fontSize: '18px' },
    className: 'lp-hv-mint-fill',
  },
  pink: {
    style: { border: '3px solid #F2A7C3', color: 'var(--ink)', fontSize: '18px' },
    className: 'lp-hv-pink-fill',
  },
  gold: {
    style: { background: 'var(--gold)', color: 'var(--on-fill)', fontSize: '19px', fontWeight: '700', boxShadow: '5px 5px 0 var(--line)' },
    className: 'lp-hv-vip-btn lp-ac-press',
  },
}

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
      {passes.map((p, i) => {
        const look = LOOK[p.id]
        const price = prices[p.id]
        const btn = BTN[look.btn]
        return (
          <article
            key={p.id}
            data-rv="1"
            data-pass={p.id}
            className={`pass-card${p.id === 'vip' ? ' lp-hv-vip-card' : ' lp-hv-card'}`}
            style={
              {
                '--spark': look.dots[0],
                border: look.border,
                background: 'var(--surface)',
                padding: '26px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minHeight: '360px',
                position: 'relative',
                transition: 'transform .14s steps(3),border-color .14s steps(2),box-shadow .14s steps(3)',
                ...look.card,
              } as CSSProperties
            }
          >
            <span className="pass-glow" aria-hidden="true" />
            {p.id === 'vip' ? (
              <>
                <span style={{ position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
                  {[
                    { top: '14%', left: '12%', c: 'var(--gold2)', s: '11px', d: '3.2s', y: '0s' },
                    { top: '32%', left: '78%', c: 'var(--gold3)', s: '8px', d: '4.1s', y: '.7s' },
                    { top: '52%', left: '24%', c: 'var(--gold)', s: '9px', d: '3.6s', y: '1.5s' },
                    { top: '68%', left: '66%', c: 'var(--gold2)', s: '12px', d: '4.6s', y: '2.2s' },
                    { top: '84%', left: '40%', c: 'var(--gold3)', s: '8px', d: '3.9s', y: '3s' },
                    { top: '44%', left: '52%', c: 'var(--gold)', s: '7px', d: '5.2s', y: '1.1s' },
                    { top: '22%', left: '44%', c: 'var(--gold2)', s: '9px', d: '4.4s', y: '2.7s' },
                    { top: '76%', left: '88%', c: 'var(--gold3)', s: '10px', d: '3.4s', y: '3.8s' },
                  ].map((k, n) => (
                    <span
                      key={n}
                      style={{ position: 'absolute', top: k.top, left: k.left, color: k.c, fontSize: k.s, lineHeight: '1', animation: `bm-spark ${k.d} steps(4) ${k.y} infinite` }}
                    >
                      ✦
                    </span>
                  ))}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    // The pale gold, not the deep one: dark ink on --gold is
                    // 4.34:1 at this size, which is under AA for small text.
                    background: 'var(--gold-fill)',
                    color: 'var(--on-fill)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    padding: '5px 9px',
                    zIndex: '1',
                  }}
                >
                  ◆ TOP TIER
                </span>
              </>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: p.id === 'vip' ? '16px' : '0' }}>
              <h3
                className="pass-foil"
                data-tier={p.id}
                style={{ margin: '0', fontFamily: 'var(--font-display)', fontSize: p.id === 'vip' ? '30px' : '28px', animationDelay: `${i * 0.5}s` }}
              >
                {p.name.toUpperCase()}
              </h3>
              <span style={{ display: 'flex', gap: '3px' }} aria-hidden="true">
                {look.dots.map((d, n) => (
                  <span key={n} style={{ width: '9px', height: '9px', background: d }} />
                ))}
              </span>
            </div>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: p.id === 'vip' ? '27px' : '26px',
                color: look.priceInk,
                background: look.priceBg,
                alignSelf: 'flex-start',
                padding: '4px 10px',
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

            <ul style={{ margin: '0', padding: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: '1.5', color: look.body }}>
              {p.perks.map((perk) => (
                <li key={perk}>+ {perk}</li>
              ))}
            </ul>

            <Link
              href="/register"
              style={{
                marginTop: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50px',
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                transition: 'background .12s steps(2),color .12s steps(2),transform .1s steps(2),box-shadow .1s steps(2)',
                ...btn.style,
              }}
              className={btn.className}
            >
              {cta}
            </Link>
          </article>
        )
      })}
    </div>
  )
}
