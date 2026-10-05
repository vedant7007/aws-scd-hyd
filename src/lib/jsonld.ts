import { event, venue } from '@/content/event'
import { passes } from '@/content/passes'
import { absolute } from './site'

/**
 * schema.org structured data for the home page: the Event (what Google's
 * event search and rich results read), the organiser, and the site. Only
 * settled facts: prices are confirmed (24 September 2026), so each pass is
 * an offer; there is no endDate because the running order is not final, and
 * search engines treat wrong structured data harshly.
 */
export function eventJsonLd(): string {
  const organizer = {
    '@type': 'Organization',
    '@id': absolute('/#organizer'),
    name: event.host,
    url: absolute('/'),
    email: event.contactEmail,
  }
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Event',
        '@id': absolute('/#event'),
        name: event.name,
        alternateName: ['AWS SCD Hyderabad 2026', 'AWS Student Community Day Hyderabad 2026'],
        startDate: event.startsAt,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        url: absolute('/'),
        image: [absolute('/opengraph-image')],
        description: `${event.name}: a student-run AWS community conference in ${event.city} on ${event.dateLabel}. A keynote, technical sessions on cloud and AI, hands-on AWS workshops, a panel discussion and a project expo, with lunch on every pass.`,
        inLanguage: 'en-IN',
        isAccessibleForFree: false,
        organizer: { '@id': absolute('/#organizer') },
        sponsor: [
          { '@type': 'Organization', name: 'Amazon Web Services', url: 'https://aws.amazon.com/' },
          { '@type': 'CollegeOrUniversity', name: venue.name, url: 'https://vjit.ac.in/' },
        ],
        location: {
          '@type': 'Place',
          name: venue.name,
          hasMap: venue.directionsUrl,
          address: { '@type': 'PostalAddress', streetAddress: venue.address, addressLocality: event.city, addressRegion: 'Telangana', addressCountry: 'IN' },
        },
        offers: passes
          .filter((p) => p.pricePaise !== null)
          .map((p) => ({
            '@type': 'Offer',
            name: `${p.name} pass`,
            price: (p.pricePaise! / 100).toFixed(2),
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            url: absolute('/register'),
          })),
      },
      organizer,
      {
        '@type': 'WebSite',
        '@id': absolute('/#website'),
        name: event.name,
        url: absolute('/'),
        inLanguage: 'en-IN',
        publisher: { '@id': absolute('/#organizer') },
      },
    ],
  }
  return JSON.stringify(data)
}
