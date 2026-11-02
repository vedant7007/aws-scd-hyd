import type { Metadata } from 'next'
import { ReportForm } from '@/components/forms/ReportForm'
import { event } from '@/content/event'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Report a problem',
  description: `Did not get your swag kit, food or something else at ${event.name}? Tell us here.`,
}

/** The report form on its own page, for anything that went wrong on the day. Stored and mailed to the organisers. */
export default function ReportPage() {
  return (
    <div className="page page-760 rise flex flex-col gap-7">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// SOMETHING MISSING?'}</span>
        <h1 className="h1 h1-lg">REPORT A PROBLEM</h1>
        <p className="lede">
          Did not get your swag kit, lunch or something your pass included? Anything else go wrong? Tell us here with your pass ID and we will sort it out. Feedback on the event itself goes in the{' '}
          <a href="https://pulse.amazon/survey/UPCU4UQO?p=0" target="_blank" rel="noopener noreferrer" className="underline">
            AWS event survey
          </a>
          .
        </p>
      </div>
      <ReportForm contact={event.contactEmail} />
    </div>
  )
}
