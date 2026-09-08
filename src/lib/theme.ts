export const THEME_COOKIE = 'theme'

/** One year. The cookie is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export type Theme = 'light' | 'dark'

/**
 * Absent means follow the OS, which is handled entirely in CSS. Only an
 * explicit choice is written to the html element, so the first server paint is
 * already correct and there is nothing to correct on hydration.
 */
export function isTheme(value: string | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}
