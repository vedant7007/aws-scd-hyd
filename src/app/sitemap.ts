import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/site'

/**
 * Public pages only. /pass/* is a private link per attendee and /admin/* is not
 * public at all, so neither ever appears here, see SPEC.md section 7.
 */
const PUBLIC_ROUTES = ['/', '/schedule', '/speakers', '/sponsors', '/code-of-conduct'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PUBLIC_ROUTES.map((route) => ({
    url: absolute(route),
    lastModified,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7,
  }))
}
