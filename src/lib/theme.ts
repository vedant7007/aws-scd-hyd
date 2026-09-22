/** localStorage key. Same on every screen of the design handoff. */
export const THEME_KEY = 'scd-theme'

export type Theme = 'light' | 'dark'

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * Runs inline before the first paint. A saved choice wins, otherwise the OS
 * preference, and the attribute is always written so both themes resolve from
 * the one token block in globals.css and nothing flashes on load. Storage can
 * be blocked or throw in a private window, so the read is guarded.
 */
export const THEME_BOOT = `(function(){var t=null;try{t=localStorage.getItem('${THEME_KEY}')}catch(e){}if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t})()`

/** Flips the theme on the document and remembers it. Safe to call anywhere on the client. */
export function toggleTheme(): Theme {
  const root = document.documentElement
  const next: Theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    // Storage unavailable. The choice still applies for this page.
  }
  return next
}
