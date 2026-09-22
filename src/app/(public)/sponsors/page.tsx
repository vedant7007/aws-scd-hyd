import type { Metadata } from 'next'
import { Sponsors } from '@/components/home/Sponsors'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Sponsors, ${event.shortName}`,
  description: `Sponsors of ${event.name}, and how to become one.`,
}

export default function SponsorsPage() {
  return <Sponsors headingLevel={1} />
}
