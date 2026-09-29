import type { Metadata } from 'next'
import { IBM_Plex_Mono, Jersey_10, Roboto } from 'next/font/google'
import './globals.css'
import { Beacon } from '@/components/layout/Beacon'
import { CloudTransition } from '@/components/layout/CloudTransition'
import { ThemeGuard } from '@/components/layout/ThemeGuard'
import { event, venue } from '@/content/event'
import { CLOUDS_BOOT } from '@/lib/clouds'
import { siteUrl } from '@/lib/site'
import { THEME_BOOT } from '@/lib/theme'

/**
 * The only place a font family is named, per SPEC.md section 2 rule 5. Each one
 * is self hosted by next/font and handed to globals.css as a CSS variable, so
 * the stack and every fallback are still composed in the one themeable file.
 *
 * Jersey 10 is display only, and it has a single weight: never set it bold,
 * or the browser fakes one. It replaced Pixelify Sans in the v3 handoff,
 * whose C read as an O. Roboto is body. IBM Plex Mono is labels and code.
 * The weights are the ones the handoff loaded.
 */
const display = Jersey_10({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-face',
})

const body = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-body-face',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono-face',
})

const DESCRIPTION = `${event.name} 2026: a student-run AWS community conference on ${event.dateLabel} at ${venue.name}, ${event.city}. Cloud and AI sessions, hands-on AWS workshops, a panel and a project expo. Passes from Rs 499, lunch included.`

/**
 * Site-wide metadata for search and link previews. Pages set their own
 * title (it slots into the template) and description; every page gets a
 * canonical URL from its own path, so the www and bare-domain copies, and
 * any tracking parameters, all count as one page to search engines.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${event.name} 2026 · 30 October, VJIT`, template: `%s · ${event.shortName} 2026` },
  description: DESCRIPTION,
  applicationName: event.name,
  keywords: [
    'AWS Student Community Day',
    'AWS Student Community Day Hyderabad',
    'AWS SCD Hyderabad',
    'AWS community day Hyderabad 2026',
    'AWS event Hyderabad',
    'cloud computing event Hyderabad',
    'AI event Hyderabad',
    'student tech conference Hyderabad',
    'AWS workshop Hyderabad',
    'VJIT',
    'Vidya Jyothi Institute of Technology',
    'AWS Student Builders Group',
    'AWS User Group Hyderabad',
    'tech events Hyderabad October 2026',
  ],
  authors: [{ name: event.host }],
  creator: event.host,
  publisher: event.host,
  category: 'technology',
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: './',
    siteName: event.name,
    title: `${event.name} 2026`,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: `${event.name} 2026`, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  formatDetection: { telephone: false, email: false, address: false },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is written by THEME_BOOT before first paint, so the attribute
    // the client hydrates against differs from the server's. That is expected.
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Theme, then the cloud overlay, before anything paints. Inline and
            synchronous on purpose: the clouds are over the page in its first
            frame and part from there, and the theme is set before they read it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: CLOUDS_BOOT }} />
        {/* First tab stop, so a keyboard user is not walked through the nav on
            every page before reaching the content. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <ThemeGuard />
        <CloudTransition />
        <Beacon />
      </body>
    </html>
  )
}
