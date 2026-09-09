import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

/**
 * Pass links are private and organiser pages are not public, so both are
 * disallowed here as well as carrying noindex. The sitemap never lists either.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/pass/', '/admin/', '/api/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
