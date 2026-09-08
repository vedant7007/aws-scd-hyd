'use client'

import { useEffect, useRef } from 'react'

/**
 * TODO(vedant): the actual visual is undecided. This is the swappable slot for
 * it, see SPEC.md section 11 item 1. Replace the body of draw() and nothing
 * else in the hero has to change.
 *
 * Colours are read from the design tokens at runtime rather than written here,
 * so a theme change in globals.css moves the canvas too.
 */
const SPACING = 34
const REACH = 150

export function HeroBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)')

    let dot = ''
    let hot = ''
    const readTokens = () => {
      const style = getComputedStyle(document.documentElement)
      dot = style.getPropertyValue('--border').trim()
      hot = style.getPropertyValue('--accent').trim()
    }

    let width = 0
    let height = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Parked off canvas until the pointer actually arrives.
    let px = -9999
    let py = -9999

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      // With no fine pointer the field breathes on its own instead of sitting dead.
      if (coarse.matches && !reduced.matches) {
        px = width * (0.5 + 0.35 * Math.sin(time / 4200))
        py = height * (0.5 + 0.25 * Math.cos(time / 5600))
      }

      for (let x = SPACING / 2; x < width; x += SPACING) {
        for (let y = SPACING / 2; y < height; y += SPACING) {
          const dx = px - x
          const dy = py - y
          const distance = Math.hypot(dx, dy)
          const pull = distance < REACH ? 1 - distance / REACH : 0

          ctx.beginPath()
          ctx.fillStyle = pull > 0 ? hot : dot
          ctx.globalAlpha = 0.35 + pull * 0.65
          ctx.arc(x + dx * pull * 0.18, y + dy * pull * 0.18, 1 + pull * 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    let frame = 0
    const loop = (time: number) => {
      draw(time)
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      if (reduced.matches) draw(0)
      else frame = requestAnimationFrame(loop)
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      px = e.clientX - rect.left
      py = e.clientY - rect.top
    }
    const onLeave = () => {
      px = -9999
      py = -9999
    }

    // A theme swap changes the custom properties, so re-read and repaint.
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
    start()

    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    themeQuery.addEventListener('change', onTheme)
    reduced.addEventListener('change', start)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerleave', onLeave)
      themeQuery.removeEventListener('change', onTheme)
      reduced.removeEventListener('change', start)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full" />
}
