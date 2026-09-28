import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

/**
 * Pass and payment links are private and organiser pages are not public, so
 * all are disallowed here as well as carrying noindex. The sitemap lists none.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/pass/', '/admin/', '/api/', '/register/pay/', '/register/preview'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
