import Link from 'next/link'
import { event } from '@/content/event'
import { Container } from './Container'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  return (
    <header className="border-b border-border">
      <Container className="flex items-center justify-between gap-6 py-4">
        <Link href="/" className="display text-step-1 no-underline text-text">
          {event.shortName}
        </Link>
        <ThemeToggle />
      </Container>
    </header>
  )
}
