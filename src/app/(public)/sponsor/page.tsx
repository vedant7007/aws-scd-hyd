import type { Metadata } from 'next'
import { ApplyForm } from '@/components/forms/ApplyForm'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Sponsor, ${event.shortName}`,
  description: `How to sponsor ${event.name}.`,
}

/** The handoff's Sponsor screen. Enquiries are stored and mailed to the organisers, see lib/forms.ts. */
export default function SponsorPage() {
  return <ApplyForm kind="sponsor" />
}
