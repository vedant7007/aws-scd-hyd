import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { event } from '@/content/event'
import { THEME_COOKIE, isTheme } from '@/lib/theme'

export const metadata: Metadata = {
  title: event.name,
  description: `${event.name}, ${event.dateLabel}, at ${event.venue.name}. A day of AI and agents, cloud engineering and careers, run by ${event.host}.`,
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Only an explicit choice is written out. Absent means follow the OS, which
  // globals.css handles, so the first paint is correct and nothing flashes.
  const chosen = (await cookies()).get(THEME_COOKIE)?.value

  return (
    <html lang="en" data-theme={isTheme(chosen) ? chosen : undefined} className="h-full">
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
