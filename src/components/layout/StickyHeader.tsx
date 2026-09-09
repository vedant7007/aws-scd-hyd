'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Transparent over the hero, solid and condensed once the page has moved.
 *
 * One IntersectionObserver on a sentinel at the very top of the document, not
 * a scroll listener. It fires twice in a page rather than sixty times a second,
 * and the callback writes a data attribute straight to the DOM rather than
 * setting React state, so a scroll never triggers a render. Everything visible
 * is a CSS transition on opacity and transform.
 */
export function StickyHeader({ children }: { children: ReactNode }) {
  const header = useRef<HTMLElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const top = sentinel.current
    const el = header.current
    if (!top || !el) return

    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.stuck = String(!entry.isIntersecting)
    })

    observer.observe(top)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <header ref={header} className="site-header" data-stuck="false">
        {children}
      </header>
    </>
  )
}
