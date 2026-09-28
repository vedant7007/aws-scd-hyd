/**
 * First party traffic counting. What the admin TRAFFIC page reads, and what
 * /api/hit writes.
 *
 * Deliberately thin. No cookie, no IP address, no user agent and no visitor
 * id is ever stored: a row is a day, a page and two counters. "Visits" is
 * counted by the browser itself (the first page view in a tab session says
 * so), which is why nothing on the server has to recognise a returning
 * person.
 */

/**
 * The pages worth counting by name. Anything else, a typo'd URL or a probe
 * for /wp-admin, lands in one OTHER row. This is what bounds the table: a
 * script posting random paths can inflate a counter, never create keys.
 */
export const TRACKED_PATHS = [
  '/',
  '/register',
  '/speak',
  '/sponsor',
  '/code-of-conduct',
] as const

export const OTHER = '(other)'

const TRACKED = new Set<string>(TRACKED_PATHS)

/** Strip the query and hash and any trailing slash, then fold into the allowlist. */
export function trackedPath(raw: string): string {
  const path = raw.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/'
  return TRACKED.has(path) ? path : OTHER
}

/** A referrer reduced to its host, lowercased, without www. Anything unparseable is dropped. */
export function refHost(raw: string): string | null {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '')
    return host && host.length <= 80 ? host : null
  } catch {
    return null
  }
}

/** The day a hit belongs to, in Hyderabad time, so midnight means midnight here. */
export function istDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

/** The last n IST days, oldest first, ending today. */
export function lastDays(n: number, now: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => istDay(new Date(now.getTime() - (n - 1 - i) * 86_400_000)))
}

/**
 * Crawlers and link unfurlers. Not a defence, just housekeeping: a preview
 * card in WhatsApp is not a person reading the page.
 */
export const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pingdom|monitor/i
