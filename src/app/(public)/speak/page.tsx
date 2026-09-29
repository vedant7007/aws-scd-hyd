import type { Metadata } from 'next'
import { SpeakerForm } from '@/components/forms/SpeakerForm'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Speaker interest, ${event.shortName}`,
  description: `Express interest in speaking at ${event.name}.`,
}

/** The organisers' speaker interest form. Submissions are stored and mailed to the organisers, see lib/forms.ts. */
export default function SpeakPage() {
  return <SpeakerForm />
}
