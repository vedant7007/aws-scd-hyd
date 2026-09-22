'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * SCD cloud page transition: a pixel cloud sheet sliding across the screen.
 * Port of the handoff's cloud-transition.js onto the App Router.
 *
 * Built entirely in JS: if this module fails to load there is no overlay at
 * all, and if the sheet image is missing the overlay is a tinted gradient.
 * Every hide path is raced against a timeout, so the screen can never be left
 * covered.
 *
 * Route change start is the intercepted click, which covers the screen and
 * then pushes the route. Route change complete is the pathname changing,
 * which clears it. A navigation that never completes, a tab that goes to the
 * background and comes back, and a bfcache restore each clear or destroy the
 * overlay on their own.
 */

const SRC = '/assets/cloud-sheet.png'
const IN_MS = 1150
const OUT_MS = 1250
const EASE = 'cubic-bezier(.45,.02,.24,1)'
/** Longest a covered screen is tolerated before it is cleared regardless. */
const COVER_LIMIT_MS = 4000

type Plan = { scale: number; dur: number; delay: number; flip: boolean; dim: number }

// Two sheets: a slower, larger one behind for depth, a sharp one in front.
const PLAN: Plan[] = [
  { scale: 1.35, dur: 1.18, delay: 0, flip: true, dim: 0.86 },
  { scale: 1.0, dur: 1.0, delay: 90, flip: false, dim: 1.0 },
]

let wrap: HTMLDivElement | null = null
let sheets: { el: HTMLDivElement; p: Plan }[] = []
let hideTimer: ReturnType<typeof setTimeout> | null = null
let killTimer: ReturnType<typeof setTimeout> | null = null

const dark = () => document.documentElement.getAttribute('data-theme') === 'dark'

function ensure() {
  if (wrap) return
  const d = dark()
  wrap = document.createElement('div')
  wrap.setAttribute('aria-hidden', 'true')
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;' +
    'background:' +
    (d ? 'linear-gradient(#0B1220,#16233A 60%,#20304C)' : 'linear-gradient(#DCEAF8,#C6DCF2 60%,#BCD4EC)') +
    ';opacity:0;transition:opacity 260ms linear;'

  sheets = []
  for (const p of PLAN) {
    const s = document.createElement('div')
    s.style.cssText =
      'position:absolute;top:-8%;left:0;width:118%;height:116%;' +
      'background-image:url(' + SRC + ');background-size:cover;' +
      'background-position:center;background-repeat:no-repeat;' +
      'image-rendering:pixelated;will-change:transform;' +
      'transform:' + tx('-118%', p) + ';' +
      (d
        ? 'filter:brightness(' + (p.dim * 0.8).toFixed(2) + ') saturate(1.15) hue-rotate(-8deg);'
        : p.dim < 1
          ? 'filter:brightness(' + p.dim + ');'
          : '')
    sheets.push({ el: s, p })
    wrap.appendChild(s)
  }
  ;(document.body || document.documentElement).appendChild(wrap)
}

function tx(pct: string, p: Plan) {
  return 'translate3d(' + pct + ',0,0) scale(' + p.scale + ')' + (p.flip ? ' scaleX(-1)' : '')
}

function settle() {
  if (!wrap) return
  wrap.style.opacity = '1'
  for (const { el, p } of sheets) {
    el.style.transition = 'transform ' + Math.round(IN_MS * p.dur) + 'ms ' + EASE + ' ' + p.delay + 'ms'
    el.style.transform = tx('-9%', p)
  }
}

function clear() {
  if (!wrap) return
  // Nothing may be clickable through a sheet on its way out.
  wrap.style.pointerEvents = 'none'
  sheets.forEach(({ el, p }, i) => {
    el.style.transition = 'transform ' + Math.round(OUT_MS * p.dur) + 'ms ' + EASE + ' ' + i * 70 + 'ms'
    el.style.transform = tx('118%', p)
  })
  wrap.style.transition = 'opacity 320ms linear ' + Math.round(OUT_MS * 0.62) + 'ms'
  wrap.style.opacity = '0'
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(destroy, OUT_MS + 700)
}

function destroy() {
  if (hideTimer) clearTimeout(hideTimer)
  if (killTimer) clearTimeout(killTimer)
  hideTimer = killTimer = null
  if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap)
  wrap = null
  sheets = []
}

function cover(done: () => void) {
  ensure()
  if (!wrap) return
  wrap.style.pointerEvents = 'auto'
  void wrap.offsetWidth
  settle()
  setTimeout(done, Math.round(IN_MS * 0.96))
  // The route may never change: a push to the same URL, a failed fetch, a
  // thrown render. The screen is uncovered anyway.
  if (killTimer) clearTimeout(killTimer)
  killTimer = setTimeout(clear, COVER_LIMIT_MS)
}

function reveal() {
  ensure()
  if (!wrap) return
  wrap.style.transition = 'none'
  wrap.style.opacity = '1'
  for (const { el, p } of sheets) {
    el.style.transition = 'none'
    el.style.transform = tx('-9%', p)
  }
  void wrap.offsetWidth
  requestAnimationFrame(() => requestAnimationFrame(clear))
  setTimeout(clear, 360)
  killTimer = setTimeout(destroy, 5000)
}

export function CloudTransition() {
  const router = useRouter()
  const pathname = usePathname()
  const arrived = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // First run is page load: clouds part. Every later run is a completed
    // route change: whatever is covering the screen slides away.
    if (arrived.current) clear()
    else {
      arrived.current = true
      reveal()
    }
  }, [pathname])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) destroy()
    }
    const onVisibility = () => {
      if (!document.hidden && wrap) clear()
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as Element | null
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      if (a.target && a.target !== '_self') return
      if (a.hasAttribute('download')) return
      const href = a.getAttribute('href') || ''
      if (!href || href.charAt(0) === '#') return
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return
      let url: URL
      try {
        url = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      // Same page: nothing to transition to. next/link handles it.
      if (url.pathname === window.location.pathname) return
      e.preventDefault()
      cover(() => router.push(url.pathname + url.search + url.hash))
    }

    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('click', onClick, true)
      destroy()
    }
  }, [router])

  return null
}
