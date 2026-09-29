import type { Metadata } from 'next'
import { SponsorSoon } from '@/components/forms/SponsorSoon'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: 'Sponsor',
  description: `Sponsor ${event.name}, a student-run AWS conference in Hyderabad. Sponsorship packages are coming soon; write to us to talk now.`,
}

export default function SponsorPage() {
  return <SponsorSoon />
}
