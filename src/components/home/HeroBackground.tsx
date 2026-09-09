'use client'

import { useEffect, useRef } from 'react'

/**
 * The centrepiece of the hero, not wallpaper: a pointer reactive field that
 * fills the composed plate the headline overlaps.
 *
 * TODO(vedant): the final visual is undecided. This is the swappable slot for
 * it, see SPEC.md section 11 item 1. Replace the body of draw() and nothing
 * else in the hero has to change.
 *
 * Performance, because this has to hold 60fps on a mid range Android:
 * - the loop only runs while the plate is on screen, watched by an observer
 * - device pixel ratio is capped at 2, so a 3x phone does not render 9x pixels
 * - the dot count is bounded by adapting spacing to the plate size
 * - colours come from the design tokens, re-read only when the theme changes
 */
const TARGET_DOTS = 900
const MIN_SPACING = 26
const REACH = 150

export function HeroBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)')

    let dot = ''
    let hot = ''
    const readTokens = () => {
      const style = getComputedStyle(document.documentElement)
      dot = style.getPropertyValue('--muted').trim()
      hot = style.getPropertyValue('--accent').trim()
    }

    let width = 0
    let height = 0
    let spacing = MIN_SPACING

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Keep the dot count roughly constant whatever the plate size, so a wide
      // desktop does not quietly cost ten times a phone.
      spacing = Math.max(MIN_SPACING, Math.sqrt((width * height) / TARGET_DOTS))
    }

    let px = -9999
    let py = -9999

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      if (coarse.matches && !reduced.matches) {
        px = width * (0.5 + 0.32 * Math.sin(time / 4200))
        py = height * (0.5 + 0.24 * Math.cos(time / 5600))
      }

      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          const dx = px - x
          const dy = py - y
          const distance = Math.hypot(dx, dy)
          const pull = distance < REACH ? 1 - distance / REACH : 0

          ctx.beginPath()
          ctx.fillStyle = pull > 0 ? hot : dot
          ctx.globalAlpha = 0.22 + pull * 0.78
          ctx.arc(x + dx * pull * 0.18, y + dy * pull * 0.18, 1 + pull * 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    let frame = 0
    let running = false
    let lastDraw = 0

    // The ambient drift is slow, so it does not need a frame every 16ms. Half
    // rate is indistinguishable here and halves the work on a phone, which is
    // exactly where the budget is tight.
    const MIN_FRAME_MS = 32

    const loop = (time: number) => {
      if (time - lastDraw >= MIN_FRAME_MS) {
        lastDraw = time
        draw(time)
      }
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      if (running) return
      running = true
      if (reduced.matches) {
        draw(0)
        running = false
        return
      }
      frame = requestAnimationFrame(loop)
    }

    const stop = () => {
      cancelAnimationFrame(frame)
      running = false
    }

    // Off screen costs nothing. Scrolling past the hero stops the loop dead.
    const visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start()
      else stop()
    })
    visibility.observe(canvas)

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      px = e.clientX - rect.left
      py = e.clientY - rect.top
    }
    const onLeave = () => {
      px = -9999
      py = -9999
    }

    const onTheme = () => {
      readTokens()
      if (reduced.matches) draw(0)
    }
    const themeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const observer = new MutationObserver(onTheme)
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })

    const onResize = () => {
      resize()
      if (reduced.matches) draw(0)
    }

    readTokens()
    resize()

    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    themeQuery.addEventListener('change', onTheme)
    reduced.addEventListener('change', onResize)

    return () => {
      stop()
      visibility.disconnect()
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerleave', onLeave)
      themeQuery.removeEventListener('change', onTheme)
      reduced.removeEventListener('change', onResize)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" />
}
