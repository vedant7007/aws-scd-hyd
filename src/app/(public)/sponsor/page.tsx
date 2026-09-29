import type { Metadata } from 'next'
import { SponsorSoon } from '@/components/forms/SponsorSoon'
import { event } from '@/content/event'

/** Rendered per request, never cached at the CDN, so the kill switch in src/proxy.ts reaches it. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sponsor',
  description: `Sponsor ${event.name}, a student-run AWS conference in Hyderabad. Sponsorship packages are coming soon; write to us to talk now.`,
}

export default function SponsorPage() {
  return <SponsorSoon />
}
