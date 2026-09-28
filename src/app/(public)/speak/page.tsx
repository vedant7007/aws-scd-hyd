import type { Metadata } from 'next'
import { ApplyForm } from '@/components/forms/ApplyForm'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Apply to speak, ${event.shortName}`,
  description: `The call for speakers at ${event.name}.`,
}

/** The handoff's Speak screen. Applications are stored and mailed to the organisers, see lib/forms.ts. */
export default function SpeakPage() {
  return <ApplyForm kind="speak" />
}
