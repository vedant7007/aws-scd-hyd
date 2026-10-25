import type { Metadata } from 'next'
import Link from 'next/link'
import { Countdown, Podium, ScoreTable } from '@/components/referral/Arcade'
import { Prizes } from '@/components/referral/Prizes'
import { event } from '@/content/event'
import { REFERRAL_CUTOFF_LABEL, referralOpen } from '@/content/referral'
import { leaderboard } from '@/lib/referral/store'

/** Rendered per request, never cached at the CDN, so the kill switch in src/proxy.ts reaches it. The board itself is memoised for a minute. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Referral leaderboard',
  description: `Bring your friends to ${event.name}. Every registration with your code is a point; the top referrers win exciting prizes.`,
}

const SHOWN = 50

export default async function LeaderboardPage() {
  const rows = (await leaderboard()).slice(0, SHOWN)
  const open = referralOpen()

  return (
    <div className="page page-760 rise">
      <section className="arc" aria-labelledby="arc-h">
        <div className="arc-marquee">
          <span className="arc-bulbs" aria-hidden="true" />
          <h1 id="arc-h" className="arc-title">
            HIGH SCORES
          </h1>
          <span className="arc-sub">bring friends · climb · win</span>
        </div>

        <div className="arc-screen">
          <div className="arc-hud">
            <span className="arc-hud-l">{open ? 'Time left to refer' : 'Final standings'}</span>
            <Countdown />
          </div>

          <Podium rows={rows} />

          {rows.length === 0 ? (
            <p className="arc-empty">
              <span className="arc-blink">PRESS START</span>
              No scores yet. Get your code and be player one.
            </p>
          ) : (
            <ScoreTable rows={rows} />
          )}
        </div>

        <div className="arc-deck">
          <Link href="/refer" className="arc-button">
            <span className="arc-button-cap">GET MY CODE</span>
          </Link>
          <div className="arc-deck-copy">
            <p>Every friend who registers with your code is a point. A group of five is five points. The top 3 win the prizes below, and anyone who brings 25 or more unlocks the secret level.</p>
            <Link href="/register" className="arc-deck-link">
              Not registered yet? Register first
            </Link>
          </div>
        </div>
      </section>

      <Prizes />

      <p className="hint">
        A referral shows on the board once the registration is made and the payment submitted, and counts for prizes only once that payment is
        verified. Rejected registrations do not count, and the organisers review the top referrals and may remove any that look wrong.
        Registrations made by {REFERRAL_CUTOFF_LABEL} count. The board updates every minute. Organisers&apos; decision is final.
      </p>
    </div>
  )
}
