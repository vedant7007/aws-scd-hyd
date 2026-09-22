import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Generated images are raster output, so they cannot reference CSS custom
 * properties. Rather than duplicating the palette here and letting it drift
 * from the theme, the light mode token values are parsed out of globals.css at
 * runtime, which keeps SPEC.md section 2 rule 5 honest.
 */
export type OgTheme = {
  bg: string
  surface: string
  text: string
  muted: string
  border: string
  accent: string
  accentInk: string
}

const FALLBACK: OgTheme = {
  bg: 'white',
  surface: 'whitesmoke',
  text: 'black',
  muted: 'dimgray',
  border: 'gainsboro',
  accent: 'orange',
  accentInk: 'black',
}

let cache: OgTheme | null = null

function readToken(css: string, name: string, depth = 0): string | null {
  // The first declaration wins. The light theme is the first block in the
  // file, and the names the images read are aliases onto it, so one level of
  // var() indirection is followed.
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css)
  if (!match) return null
  const value = match[1].trim()
  const ref = /^var\(--([\w-]+)\)$/.exec(value)
  return ref && depth < 3 ? readToken(css, ref[1], depth + 1) : value
}

export function ogTheme(): OgTheme {
  if (cache) return cache

  try {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    cache = {
      bg: readToken(css, 'bg') ?? FALLBACK.bg,
      surface: readToken(css, 'surface') ?? FALLBACK.surface,
      text: readToken(css, 'text') ?? FALLBACK.text,
      muted: readToken(css, 'muted') ?? FALLBACK.muted,
      border: readToken(css, 'border') ?? FALLBACK.border,
      accent: readToken(css, 'accent') ?? FALLBACK.accent,
      accentInk: readToken(css, 'accent-ink') ?? FALLBACK.accentInk,
    }
  } catch {
    // Bundled without the source file. Named CSS colours, no literals.
    cache = FALLBACK
  }
  return cache
}
