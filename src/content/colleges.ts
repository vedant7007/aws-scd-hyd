/** Students type their college every which way. These fold the common ones together for counting. */
// ponytail: a hand list, add a line when a new college shows up spelt five ways.
const COLLEGES: [RegExp, string][] = [
  [/^(vjit|vidh?ya\s*jy)/i, 'VJIT'],
  [/^(klu\b|kl\s*university)/i, 'KL University'],
  [/^kg\s*reddy/i, 'KG Reddy College of Engineering and Technology'],
  [/^(cbit|chaitanya\s*bharathi)/i, 'CBIT'],
  [/^stanley/i, 'Stanley College of Engineering and Technology'],
  [/^geethanjali/i, 'Geethanjali College of Engineering and Technology'],
  [/^klh/i, 'KLH University'],
  [/^(smru|srmu).*niat/i, 'SMRU x NIAT'],
  [/^(griet|gokaraju)/i, 'GRIET'],
]
export const collegeOf = (raw: string) => COLLEGES.find(([re]) => re.test(raw.trim()))?.[1] ?? raw.trim().replace(/\s+/g, ' ')

const SMALL = new Set(['of', 'and', 'for', 'the', 'in', '&'])

/** A college as a short tag for public pages: VJIT, CBIT, or the initials of a longer name (SCET). */
export function collegeShort(raw: string): string {
  const name = collegeOf(raw)
  if (name.length <= 8) return name.toUpperCase()
  const words = name.split(/[\s,()]+/).filter((w) => w && !SMALL.has(w.toLowerCase()))
  return words.map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w[0]!.toUpperCase())).join('').slice(0, 8)
}
