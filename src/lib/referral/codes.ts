import { randomInt } from 'node:crypto'

/**
 * Referral codes: 4 to 12 capital letters and digits, at least one letter,
 * nothing else. No dashes, no spaces, so a code survives being read out loud
 * and typed on a phone. People choose from suggestions built on a word they
 * type; the filter below keeps abuse and impersonation off a public page.
 */
export const CODE_MIN = 4
export const CODE_MAX = 12
const CODE = new RegExp(`^(?=.*[A-Z])[A-Z0-9]{${CODE_MIN},${CODE_MAX}}$`)

/** What someone typed, as a code: uppercase, letters and digits only. Null when it cannot be one. */
export function normaliseCode(raw: string): string | null {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return CODE.test(v) ? v : null
}

/*
 * The filter. Checked against the code with digits read as the letters they
 * stand in for (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b), so L0DA is LODA.
 * ANYWHERE words are blocked inside any code. WHOLE words are blocked only
 * as a whole run of letters, because they hide inside innocent names:
 * "class", "grape", "skill", "gandhi", "analytics", "peacock".
 * ponytail: a hand list, best effort. An admin can still delete a registration that slips through.
 */
const ANYWHERE = [
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'pussy', 'whore', 'slut', 'bastard', 'asshole', 'nigg', 'faggot', 'retard', 'porn', 'boob', 'tits', 'penis', 'vagina',
  'jizz', 'horny', 'dildo', 'wank', 'twat', 'sexy', 'nude', 'rapist', 'molest',
  'chutiya', 'chutia', 'chutiye', 'bhosd', 'bhosad', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'benchod', 'gandu', 'gaand', 'lauda', 'lavda',
  'lawda', 'randi', 'harami', 'kamina', 'kamine', 'jhaant', 'jhant', 'chodu', 'lanja', 'lanjakodaka', 'dengey', 'puku', 'modda', 'kojja', 'naayala', 'sulli',
  'nazi', 'hitler', 'terrorist',
  // Impersonation: nobody's code may claim to be the organisers.
  'admin', 'official', 'organiser', 'organizer', 'support',
]
const WHOLE = ['ass', 'sex', 'cum', 'fag', 'dick', 'cock', 'prick', 'anal', 'rape', 'kill', 'gand', 'lund', 'loda', 'chut', 'chod', 'dengu', 'gudda', 'aws', 'scd', 'vjit', 'test', 'null']

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's' }

/** True when a code (or a word someone typed) may not be used. */
export function isBlocked(code: string): boolean {
  const plain = code.toLowerCase()
  const read = plain.replace(/[0-9@$]/g, (c) => LEET[c] ?? c)
  // Both readings: "SEX69" is a run of letters "sex"; "S3X" reads as "sex".
  for (const s of [plain, read]) {
    if (ANYWHERE.some((w) => s.includes(w))) return true
    const runs = s.match(/[a-z]+/g) ?? []
    if (runs.some((r) => WHOLE.includes(r))) return true
  }
  return false
}

/** A usable code: the right shape and not blocked. */
export const isUsableCode = (code: string) => normaliseCode(code) === code && !isBlocked(code)

/**
 * Up to `n` candidate codes from a word and the person's name, best first,
 * every one usable. Availability is the caller's check (it needs the table).
 */
export function candidates(want: string, first: string, last: string, n = 12): string[] {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const base = clean(want).slice(0, CODE_MAX)
  const f = clean(first).slice(0, 9)
  const l = clean(last)
  const two = () => String(randomInt(10, 100))
  const out = [
    base,
    `${base.slice(0, 10)}26`,
    `${base.slice(0, 9)}SCD`,
    `${base.slice(0, 10)}${two()}`,
    `${base.slice(0, 10)}${two()}`,
    `${base.slice(0, 11)}${l.slice(0, 1)}`,
    f,
    `${f}${l.slice(0, 1)}`,
    `${f}26`,
    `${f}${two()}`,
    `${f.slice(0, 6)}${l.slice(0, 3)}`,
    `${f}${two()}`,
  ]
  return [...new Set(out)].filter(isUsableCode).slice(0, n)
}

/* Self-check: `npx tsx src/lib/referral/codes.ts` runs these. */
if (process.argv[1]?.endsWith('codes.ts')) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error(m)
  }
  assert(normaliseCode('vedant-26') === 'VEDANT26', 'normalise strips dashes')
  assert(normaliseCode('1234') === null, 'needs a letter')
  assert(normaliseCode('ab') === null, 'too short')
  assert(normaliseCode('abcdefghijklm') === null, 'too long')
  for (const bad of ['FUCK1', 'SH1T', 'ASS', 'ASS99', 'SEX', 'S3X', 'L0DA', 'CHUTIYA', 'GANDU7', 'AWS', 'AWSADMIN', 'OFFICIAL1', 'BHOSDK'])
    assert(isBlocked(bad), `should block ${bad}`)
  for (const ok of ['CLASS', 'GRAPE', 'SKILL', 'GANDHI', 'ANALYTICS', 'PEACOCK', 'VEDANT26', 'SUSSEX9', 'ASSAM', 'SCOTT'])
    assert(!isBlocked(ok), `should allow ${ok}`)
  const c = candidates('vedant', 'Vedant', 'Idlgave')
  assert(c[0] === 'VEDANT' && c.includes('VEDANT26') && c.includes('VEDANTSCD') && c.every(isUsableCode), 'candidates')
  assert(candidates('fuck', 'Ravi', 'K').every((x) => !x.includes('FUCK')), 'candidates drop blocked words')
  console.log('referral codes: all checks passed')
}
