import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { event } from '@/content/event'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'

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
 * anyone through a gate. No pass id and no QR, because these are made to be
 * posted in public.
 */
export default async function SharePage({ params }: PageProps<'/pass/[passId]/share'>) {
  const { passId: token } = await params
  const attendee = await getAttendee(normalisePassId(token) ?? '')
  if (!attendee || (attendee.state !== 'VERIFIED' && attendee.state !== 'SESSIONS_SELECTED')) notFound()

  const story = `/api/pass/${token}/share?format=story`
  const card = `/api/pass/${token}/share?format=card`

  return (
    <div className="page page-720 rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// TELL PEOPLE'}</span>
        <h1 className="h1">SAY YOU ARE GOING</h1>
        <p className="lede">
          Two ready made images. Long press or right click to save, then post. Nothing on them can be used to get into the event, so they
          are safe to share.
        </p>
      </div>

      <div className="grid gap-8 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <figure className="m-0 flex flex-col gap-3">
          <figcaption className="lbl">Instagram story, 1080 by 1920</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, no layout shift risk and next/image would only add a proxy hop */}
          <img src={story} alt={`Story card saying ${attendee.name} is going to ${event.shortName}`} className="share-img share-story" />
          <a className="btn self-start" href={story} download="scd-story.png">
            OPEN THE STORY IMAGE
          </a>
        </figure>

        <figure className="m-0 flex flex-col gap-3">
          <figcaption className="lbl">LinkedIn and X, 1200 by 627</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src={card} alt={`Landscape card saying ${attendee.name} is going to ${event.shortName}`} className="share-img" />
          <a className="btn self-start" href={card} download="scd-card.png">
            OPEN THE LANDSCAPE IMAGE
          </a>
        </figure>
      </div>

      <Link className="btn btn-ink self-start" href={`/pass/${token}`}>
        &lt; BACK TO YOUR PASS
      </Link>
    </div>
  )
}
