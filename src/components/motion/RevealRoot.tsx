'use client'

import { useEffect } from 'react'

/**
 * Entrance choreography, done once per element.
 *
 * This replaced scroll driven CSS animation, which measured badly. With
 * animation-timeline driving the reveals and the pinned tracks stage, a
 * throttled scroll produced 18 long tasks and a 76ms p95 frame: Chrome was
 * ticking those timelines on the main thread, not the compositor, so every
 * scroll frame paid for them.
 *
 * One observer watches every [data-reveal] on the page, sets an attribute the
 * first time each becomes visible, then stops watching it. After a section has
 * arrived it costs nothing at all, and the animation itself is a plain one shot
 * on opacity and transform.
 *
 * Nothing is hidden in the server HTML, so with JavaScript off or broken the
 * page is simply the finished layout.
 */
export function RevealRoot() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-visible])')
    if (targets.length === 0) return

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => (el.dataset.visible = 'true'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.visible = 'true'
          // Once it has arrived there is nothing left to watch.
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return null
}
