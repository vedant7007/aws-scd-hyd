'use client'

import { useLayoutEffect } from 'react'
import { isTheme, THEME_KEY } from '@/lib/theme'

/**
 * THEME_BOOT writes data-theme on <html> before the first paint. A client
 * side render of the root layout, which the not-found boundary performs,
 * makes React re-acquire the <html> singleton and drop the attribute, and
 * the inline script is not run again. This puts it back in the same commit,
 * before that render paints, so a 404 keeps the reader's theme.
 */
export function ThemeGuard() {
  useLayoutEffect(() => {
    const root = document.documentElement
    if (isTheme(root.dataset.theme)) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(THEME_KEY)
    } catch {
      // Storage can be blocked. The OS preference still applies.
    }
    root.dataset.theme = isTheme(saved) ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  return null
}
