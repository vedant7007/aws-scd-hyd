'use client'

import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, isTheme, type Theme } from '@/lib/theme'

/**
 * The visible label is chosen by CSS from the current theme, not by React
 * state, so the server and client render identical markup and there is no
 * hydration mismatch and no flash.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const chosen = root.dataset.theme
    const current: Theme = isTheme(chosen)
      ? chosen
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    const next: Theme = current === 'dark' ? 'light' : 'dark'

    root.dataset.theme = next
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
  }

  return (
    <button
      type="button"
      onClick={toggle}
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
