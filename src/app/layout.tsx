import type { Metadata } from 'next'
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { event, venue } from '@/content/event'
import { THEME_COOKIE, isTheme } from '@/lib/theme'

/**
 * The only place a font family is named, per SPEC.md section 2 rule 5. Each one
 * is self hosted by next/font and handed to globals.css as a CSS variable, so
 * the stack and every fallback are still composed in the one themeable file.
 * All three are variable fonts, so no weight list is needed.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-face',
})

const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-face',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-face',
})

export const metadata: Metadata = {
  title: event.name,
  description: `${event.name}, ${event.dateLabel}, at ${venue.name}. A day of AI and agents, cloud engineering and careers, run by ${event.host}.`,
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Only an explicit choice is written out. Absent means follow the OS, which
  // globals.css handles, so the first paint is correct and nothing flashes.
  const chosen = (await cookies()).get(THEME_COOKIE)?.value

  return (
    <html
      lang="en"
      data-theme={isTheme(chosen) ? chosen : undefined}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
