/**
 * SPEC.md section 2 rule 5: all visual identity lives in src/app/globals.css.
 * A hex value, font name, radius or shadow anywhere else means the 12 September
 * theme swap stops being a one-file edit, so fail loudly instead.
 *
 *   npm run check:tokens
 */
import { globSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

const ALLOWED = 'src/app/globals.css'

const RULES = [
  { what: 'hex colour', re: /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi },
  { what: 'colour function', re: /\b(?:rgba?|hsla?|oklch|color-mix)\s*\(/gi },
  { what: 'font name', re: /\b(?:font-family|fontFamily)\b|"(?:Bricolage|Inter|JetBrains)/g },
  { what: 'shadow', re: /\b(?:box-shadow|boxShadow|drop-shadow|shadow-\[)/g },
  { what: 'radius', re: /\b(?:border-radius|borderRadius|rounded-\[)/g },
]

const files = globSync('src/**/*.{ts,tsx,css}').filter((f) => relative('.', f).replace(/\\/g, '/') !== ALLOWED)

let failed = 0
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const { what, re } of RULES) {
    for (const match of source.matchAll(re)) {
      const line = source.slice(0, match.index).split('\n').length
      console.error(`${file}:${line}  ${what} literal "${match[0]}" belongs in ${ALLOWED}`)
      failed++
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} violation(s). Move the value into ${ALLOWED} and reference it with a token.`)
  process.exit(1)
}
console.log(`ok, ${files.length} files carry no visual literals, everything comes from ${ALLOWED}`)
