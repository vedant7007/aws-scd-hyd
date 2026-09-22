'use client'

import { toggleTheme } from '@/lib/theme'

/**
 * The handoff's toggle. The dot and the label are chosen by CSS from the
 * html attribute, not by React state, so the server and client render the
 * same markup and nothing flashes. The label names the theme a click gives.
 */
export function ThemeToggle() {
  return (
    <button type="button" onClick={toggleTheme} aria-label="Toggle dark mode" className="theme-toggle">
      <span data-theme-dot="1" aria-hidden="true" />
      <span data-theme-label="dark">DARK</span>
      <span data-theme-label="light">LIGHT</span>
    </button>
  )
}
