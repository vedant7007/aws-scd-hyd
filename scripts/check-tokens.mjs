/**
 * SPEC.md section 2 rule 5: the theme must stay swappable from one file.
 * A hex value, colour function, font stack, radius or shadow anywhere in src/
 * other than src/app/globals.css breaks that, so fail loudly instead.
 *
 * The one carve out is next/font. Loading a face needs a real module import, so
 * src/app/layout.tsx may name families. It hands them to globals.css as CSS
 * variables and the stack, including fallbacks, is still composed there.
 *
 *   npm run check:tokens
 */
import { globSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

const THEME_FILE = 'src/app/globals.css'
const FONT_DECLARATION_FILE = 'src/app/layout.tsx'

/**
 * Generated images and the pre stylesheet error page cannot use CSS custom
 * properties: satori rasterises, and global-error renders before the app
 * stylesheet exists. Their colours still come from the theme via ogTheme(), so
 * only the font name rule is waived for them.
 */
const RASTER_FILES = [
  'src/app/opengraph-image.tsx',
  'src/app/api/pass/[token]/share/route.tsx',
  'src/app/global-error.tsx',
]

const RULES = [
  { what: 'hex colour', re: /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi },
  { what: 'colour function', re: /\b(?:rgba?|hsla?|oklch|lab|color-mix)\s*\(/gi },
  {
    what: 'font name',
    re: /\b(?:font-family|fontFamily)\b|Bricolage[ _]Grotesque|JetBrains[ _]Mono|["']Inter["']|\b(?:Helvetica|Arial|Georgia|Roboto)\b/g,
  },
  { what: 'shadow', re: /\b(?:box-shadow|boxShadow|drop-shadow|shadow-\[)/g },
  { what: 'radius', re: /\b(?:border-radius|borderRadius|rounded-\[)/g },
]

/** '*' exempts the file entirely, otherwise only the named rules are skipped. */
const EXEMPT = new Map([
  [THEME_FILE, '*'],
  [FONT_DECLARATION_FILE, new Set(['font name'])],
  ...RASTER_FILES.map((f) => [f, new Set(['font name'])]),
])

const normalise = (file) => relative('.', file).replace(/\\/g, '/')

const files = globSync('src/**/*.{ts,tsx,css}')

let failed = 0
let skipped = 0
for (const file of files) {
  const key = normalise(file)
  const exempt = EXEMPT.get(key)
  if (exempt === '*') {
    skipped++
    continue
  }

  const source = readFileSync(file, 'utf8')
  for (const { what, re } of RULES) {
    if (exempt?.has(what)) continue
    for (const match of source.matchAll(re)) {
      const line = source.slice(0, match.index).split('\n').length
      console.error(`${key}:${line}  ${what} literal "${match[0]}" belongs in ${THEME_FILE}`)
      failed++
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} violation(s). Move the value into ${THEME_FILE} and reference it with a token.`)
  process.exit(1)
}
console.log(
  `ok, ${files.length - skipped} files carry no visual literals, everything resolves through ${THEME_FILE}`,
)
