'use client'

import { toggleTheme } from '@/lib/theme'

/**
 * The visible label is chosen by CSS from the current theme, not by React
 * state, so the server and client render identical markup and there is no
 * hydration mismatch and no flash.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Switch colour theme"
      className="cta-quiet text-step--1 cursor-pointer"
    >
      <span className="on-light" aria-hidden="true">
        Dark
      </span>
      <span className="on-dark" aria-hidden="true">
        Light
      </span>
    </button>
  )
}
