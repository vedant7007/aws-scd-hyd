'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * App Router glue for the cloud page transition. The engine itself is
 * CLOUDS_BOOT in lib/clouds.ts, run inline before first paint; this only
 * tells it when a route change starts and when one has completed.
 *
 * Start is the intercepted click: cover, then push the route. Complete is
 * the pathname changing: clear. If the engine did not boot (reduced motion,
 * script blocked) or the sheet has not decoded yet, links behave as plain
 * links and nothing is ever drawn over the page.
 */

type Clouds = {
  cover: (done: () => void) => void
  clear: () => void
  ready: () => boolean
}

declare global {
  interface Window {
    __scdClouds?: Clouds
  }
}

export function CloudTransition() {
  const router = useRouter()
  const pathname = usePathname()
  const arrived = useRef(false)

  useEffect(() => {
    // First run is the page load, which the engine handles itself. Every
    // later run is a completed route change: let the new page paint, then
    // part the clouds over it.
    if (!arrived.current) {
      arrived.current = true
      return
    }
    const raf = requestAnimationFrame(() => window.__scdClouds?.clear())
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const clouds = window.__scdClouds
      if (!clouds || !clouds.ready()) return
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
      clouds.cover(() => router.push(url.pathname + url.search + url.hash))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [router])

  return null
}
