import type { Metadata } from 'next'
import { SpeakerForm } from '@/components/forms/SpeakerForm'
import { event } from '@/content/event'

/** Rendered per request, never cached at the CDN, so the kill switch in src/proxy.ts reaches it. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Call for speakers',
  description: `Speak at ${event.name} on 30 October 2026. Tell us which cloud or AI session you would like to take: Cloud 101, building on AWS, architecting for scale, generative AI, AI agents, or a hands-on workshop.`,
}

/** The organisers' speaker interest form. Submissions are stored and mailed to the organisers, see lib/forms.ts. */
export default function SpeakPage() {
  return <SpeakerForm />
}
