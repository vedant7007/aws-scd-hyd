/**
 * The public origin. Falls back to localhost so sitemap and OG URLs are still
 * absolute in development, where NEXT_PUBLIC_SITE_URL is usually unset.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

export const absolute = (path: string): string => `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
