import type { Metadata } from 'next'
import { SponsorSoon } from '@/components/forms/SponsorSoon'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Sponsor, ${event.shortName}`,
  description: `Sponsorship for ${event.name} opens soon.`,
}

export default function SponsorPage() {
  return <SponsorSoon />
}
