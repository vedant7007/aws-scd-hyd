'use client'

import { useEffect, useRef } from 'react'

/**
 * The drifting grid behind /register, and the cell that snaps to the pointer
 * and cycles the session accents.
 *
 * It renders OUTSIDE .page.rise on purpose. .rise leaves its children with a
 * transform (pl-rise ends on translate3d(0,0,0), and fill-mode both keeps it),
 * and a transformed ancestor makes position:fixed resolve against that
 * ancestor instead of the viewport, so the cell lands nowhere near the cursor.
 *
 * CSS, not canvas: the sheet animates transform only and the cell is placed by
 * two custom properties, so nothing here runs a frame loop.
 */

/** The grid pitch, in pixels. Matches the repeat in .rg-grid::before. */
const CELL = 28

export function DriftGrid() {
  const grid = useRef<HTMLDivElement>(null)

  // Pointer devices only: a finger has no hover, and a touch would leave a
  // cell lit behind it after the finger lifts.
  useEffect(() => {
    const el = grid.current
    if (!el) return
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return

    const onMove = (e: PointerEvent) => {
      el.style.setProperty('--cx', `${Math.floor(e.clientX / CELL) * CELL}px`)
      el.style.setProperty('--cy', `${Math.floor(e.clientY / CELL) * CELL}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <div ref={grid} className="rg-grid" aria-hidden="true">
      <span className="rg-cell" />
    </div>
  )
}
