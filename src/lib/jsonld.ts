import { event, venue } from '@/content/event'
import { absolute } from './site'

/**
 * schema.org Event. Deliberately minimal: no offers block while prices are
 * TODO(vedant), and no endDate while the running order is a placeholder.
 * Asserting a price or a finish time we have not agreed would be worse than
 * omitting them, and search engines treat wrong structured data harshly.
 */
export function eventJsonLd(): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: event.startsAt,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: absolute('/'),
    image: [absolute('/opengraph-image')],
    description: `A student run community conference in ${event.city}: AI and agents, cloud engineering and careers.`,
    organizer: {
      '@type': 'Organization',
      name: event.host,
    },
    location: {
      '@type': 'Place',
      name: venue.name,
      ...(venue.address
        ? { address: { '@type': 'PostalAddress', streetAddress: venue.address, addressLocality: event.city } }
        : { address: { '@type': 'PostalAddress', addressLocality: event.city } }),
    },
  }

  return JSON.stringify(data)
}
