import type { Metadata } from 'next'
import Link from 'next/link'
import { Prizes } from '@/components/referral/Prizes'
import { RefDesk } from '@/components/referral/RefDesk'
import { event } from '@/content/event'
import { REFERRAL_CUTOFF_LABEL } from '@/content/referral'
import { normalisePassId } from '@/lib/db/keys'

/** Rendered per request, never cached at the CDN, so the kill switch in src/proxy.ts reaches it. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your referral code',
  description: `Get your referral code for ${event.name}, share it, and climb the leaderboard.`,
  robots: { index: false, follow: false },
}

/** Get your own code, or add the code of whoever told you about the event. The emails link here with the pass ID filled in. */
export default async function ReferPage({ searchParams }: PageProps<'/refer'>) {
  const raw = (await searchParams).pass
  const pass = (typeof raw === 'string' && normalisePassId(raw)) || ''
  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// BRING YOUR FRIENDS'}</span>
        <h1 className="h1 h1-lg">YOUR REFERRAL CODE</h1>
        <p className="lede">
          Pick a code, share your link, and every friend who registers with it is a point on the{' '}
          <Link href="/leaderboard">leaderboard</Link>. The top 3 win the prizes below. Counting ends {REFERRAL_CUTOFF_LABEL}.
        </p>
      </div>
      <RefDesk initialPass={pass} />
      <Prizes compact />
    </div>
  )
}
