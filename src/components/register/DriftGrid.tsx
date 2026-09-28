'use client'

import { useEffect, useRef } from 'react'

/**
 * The drifting grid behind /register, and the crosshair that tracks the
 * pointer across it through the five session accents.
 *
 * It renders OUTSIDE .page.rise on purpose. .rise leaves its children with a
 * transform (pl-rise ends on translate3d(0,0,0), and fill-mode both keeps it),
 * and a transformed ancestor makes position:fixed resolve against that
 * ancestor instead of the viewport, so the crosshair lands nowhere near the cursor.
 *
 * CSS, not canvas: the sheet animates transform only and the lines are placed
 * by two custom properties, so nothing here runs a frame loop.
 */

export function DriftGrid() {
  const grid = useRef<HTMLDivElement>(null)

  // Pointer devices only: a finger has no hover, and a touch would leave the
  // crosshair stranded where the finger lifted.
  useEffect(() => {
    const el = grid.current
    if (!el) return
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return

    // Unsnapped. Rounding to the grid is what made it read as a block.
    const onMove = (e: PointerEvent) => {
      el.style.setProperty('--cx', `${e.clientX}px`)
      el.style.setProperty('--cy', `${e.clientY}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <div ref={grid} className="rg-grid" aria-hidden="true">
      <span className="rg-cross">
        <i />
        <i />
      </span>
    </div>
  )
}
