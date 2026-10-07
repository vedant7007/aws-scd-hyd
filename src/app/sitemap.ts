import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/site'

/**
 * Public pages only. /pass/* and /register/pay/* are private links per
 * attendee and /admin/* is not public at all, so none of them ever appears here, see SPEC.md section 7.
 *
 * /register is always listed: while registrations are closed it is the notify
 * page, which is exactly the page someone searching for tickets should land on.
 */
const PUBLIC_ROUTES = ['/', '/register', '/attending', '/speak', '/sponsor', '/code-of-conduct'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PUBLIC_ROUTES.map((route) => ({
    url: absolute(route),
    lastModified,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7,
  }))
}
