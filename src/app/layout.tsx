import type { Metadata } from 'next'
import { IBM_Plex_Mono, Pixelify_Sans, Roboto } from 'next/font/google'
import './globals.css'
import { CloudTransition } from '@/components/layout/CloudTransition'
import { event, venue } from '@/content/event'
import { THEME_BOOT } from '@/lib/theme'

/**
 * The only place a font family is named, per SPEC.md section 2 rule 5. Each one
 * is self hosted by next/font and handed to globals.css as a CSS variable, so
 * the stack and every fallback are still composed in the one themeable file.
 *
 * Pixelify Sans is display only. Roboto is body. IBM Plex Mono is every
 * number, label and code: Pixelify's digits are ambiguous, so numbers never
 * render in it. The weights are the ones the handoff loaded.
 */
const display = Pixelify_Sans({
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

export const metadata: Metadata = {
  title: event.name,
  description: `${event.name}, ${event.dateLabel}, at ${venue.name}. A day of AI and agents, cloud engineering and careers, run by ${event.host}.`,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is written by THEME_BOOT before first paint, so the attribute
    // the client hydrates against differs from the server's. That is expected.
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Theme before anything paints. Inline and synchronous on purpose. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* First tab stop, so a keyboard user is not walked through the nav on
            every page before reaching the content. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <CloudTransition />
      </body>
    </html>
  )
}
