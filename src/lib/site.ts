/**
 * The public origin. Falls back to localhost so sitemap and OG URLs are still
 * absolute in development, where NEXT_PUBLIC_SITE_URL is usually unset.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

export const absolute = (path: string): string => `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`

/**
 * What every ticket QR holds, from 29 October 2026: a link to /g/<pass id>.
 * The link, not the page behind it, is printed forever, so what a scan does
 * can change later in app/g without reissuing a single ticket. The gate
 * scanner reads the pass id out of it either way.
 */
export const gateLink = (passId: string): string => absolute(`/g/${passId}`)
