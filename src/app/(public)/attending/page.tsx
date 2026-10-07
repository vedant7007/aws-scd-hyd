import type { Metadata } from 'next'
import { AttendingMaker } from '@/components/attending/AttendingMaker'
import { event } from '@/content/event'

/** Rendered per request, never cached at the CDN, so the kill switch in src/proxy.ts reaches it. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "I'm attending",
  description: `Put your photo in the ${event.name} frame and share it on LinkedIn, Instagram or WhatsApp.`,
}

/** The "I'm attending" picture maker: photo in, frame on, download or share. */
export default function AttendingPage() {
  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{"// TELL EVERYONE YOU'RE COMING"}</span>
        <h1 className="h1 h1-lg">I&apos;M ATTENDING</h1>
        <p className="lede">Add your photo to the frame, move and zoom it into place, then download or share it to LinkedIn, Instagram or WhatsApp.</p>
      </div>
      <AttendingMaker />
    </div>
  )
}
