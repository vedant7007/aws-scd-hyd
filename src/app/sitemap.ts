import type { MetadataRoute } from 'next'
import { registrationIsOpen } from '@/lib/tickets/launch'
import { absolute } from '@/lib/site'

/**
 * Public pages only. /pass/* is a private link per attendee and /admin/* is not
 * public at all, so neither ever appears here, see SPEC.md section 7.
 */
const PUBLIC_ROUTES = ['/', '/schedule', '/speakers', '/sponsors', '/code-of-conduct', '/register'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const open = await registrationIsOpen()
  return PUBLIC_ROUTES.filter((route) => route !== '/register' || open).map((route) => ({
    url: absolute(route),
    lastModified,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7,
  }))
}
