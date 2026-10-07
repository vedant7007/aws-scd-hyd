import type { Metadata } from 'next'
import { BuilderIdForm } from '@/components/attending/BuilderIdForm'
import { event } from '@/content/event'
import { normalisePassId } from '@/lib/db/keys'

/** Rendered per request, never cached at the CDN, so the kill switch in src/proxy.ts reaches it. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Add your AWS Builder ID',
  description: `Add your AWS Builder ID to your ${event.name} registration.`,
  robots: { index: false, follow: false },
}

/** For registrations made before the flow asked for a Builder ID: the email links here with the pass ID filled in. */
export default async function BuilderIdPage({ searchParams }: PageProps<'/builder-id'>) {
  const raw = (await searchParams).pass
  const pass = (typeof raw === 'string' && normalisePassId(raw)) || ''
  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// ONE MORE THING'}</span>
        <h1 className="h1 h1-lg">ADD YOUR AWS BUILDER ID</h1>
        <p className="lede">Every attendee needs an AWS Builder ID for the event. Add your @username to your registration below; it takes a minute.</p>
      </div>
      <BuilderIdForm initialPass={pass} />
    </div>
  )
}
