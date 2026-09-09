'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The pinned stage. Sticky holds the panel still while the page scrolls past
 * it, and one observer over evenly spaced markers decides which track is
 * showing.
 *
 * The first version drove this with a scroll timeline, which measured at 34.7ms
 * p95 and five long tasks on a throttled scroll all by itself. Advancing on
 * discrete observer callbacks instead means the panel change is a CSS
 * transition and a scroll frame does no JavaScript at all.
 */
export function TracksStage({ count, children }: { count: number; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stage.current
    if (!el || count < 2) return

    const markers = Array.from(el.querySelectorAll<HTMLElement>('[data-track-marker]'))
    if (markers.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = entry.target.getAttribute('data-track-marker')
          if (index) el.dataset.active = index
        }
      },
      // A thin band across the middle, so exactly one marker is inside it.
      { rootMargin: '-50% 0px -50% 0px' },
    )

    markers.forEach((m) => observer.observe(m))

    // Only now is pinning safe to apply. Without this attribute the stage stays
    // an ordinary list, which is what a browser with no JavaScript will see.
    el.dataset.ready = 'true'

    return () => {
      observer.disconnect()
      delete el.dataset.ready
    }
  }, [count])

  return (
    <div ref={stage} className="tracks-stage" data-count={count} data-active="0">
      {children}
      {/* Markers are laid down the stage, one per track, and only tell the
          observer where we are. They render nothing. */}
      <div className="tracks-markers" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} data-track-marker={String(i)} />
        ))}
      </div>
    </div>
  )
}
