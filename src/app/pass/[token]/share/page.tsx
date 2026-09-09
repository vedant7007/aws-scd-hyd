import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { event } from '@/content/event'
import { getAttendeeByToken } from '@/lib/db/queries'

export const metadata: Metadata = {
  title: 'Share that you are going',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

/**
 * Students posting their own attendance is the cheapest marketing there is, so
 * the card is generated for them rather than asking them to make one.
 *
 * The images carry a first name and the event details, and nothing that gets
 * anyone through a gate. No ticket ref and no QR, because these are made to be
 * posted in public.
 */
export default async function SharePage({ params }: PageProps<'/pass/[token]/share'>) {
  const { token } = await params
  const attendee = await getAttendeeByToken(token)
  if (!attendee) notFound()

  const story = `/api/pass/${token}/share?format=story`
  const card = `/api/pass/${token}/share?format=card`

  return (
    <Container className="flex flex-col gap-12 py-16">
      <div className="measure">
        <h1 className="display text-step-3">Tell people you are going</h1>
        <p className="mt-4 text-step-1 text-muted">
          Two ready made images. Long press or right click to save, then post. Nothing on them can be used
          to get into the event, so they are safe to share.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <figure className="flex flex-col gap-4">
          <figcaption className="text-step--1 text-muted">
            Instagram story, 1080 by 1920
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, no layout shift risk and next/image would only add a proxy hop */}
          <img src={story} alt={`Story card saying ${attendee.name} is going to ${event.shortName}`} className="share-preview share-story" />
          <a className="cta-quiet" href={story} download={`scd-story-${attendee.ticketRef}.png`}>
            Open the story image
          </a>
        </figure>

        <figure className="flex flex-col gap-4">
          <figcaption className="text-step--1 text-muted">LinkedIn and X, 1200 by 627</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src={card} alt={`Landscape card saying ${attendee.name} is going to ${event.shortName}`} className="share-preview" />
          <a className="cta-quiet" href={card} download={`scd-card-${attendee.ticketRef}.png`}>
            Open the landscape image
          </a>
        </figure>
      </div>

      <p>
        <Link className="link" href={`/pass/${token}`}>
          Back to your pass
        </Link>
      </p>
    </Container>
  )
}
