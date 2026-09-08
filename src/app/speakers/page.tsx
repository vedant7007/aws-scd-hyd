import type { Metadata } from 'next'
import { Speakers } from '@/components/home/Speakers'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Speakers, ${event.shortName}`,
  description: `Who is speaking at ${event.name}.`,
}

export default function SpeakersPage() {
  return <Speakers />
}
