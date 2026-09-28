import { doorsLabel, event, venue } from '@/content/event'
import type { Tier } from '@/lib/db/types'
import { QrPass } from './QrPass'

/** One chosen session: "Technical" or "Workshop", and its title. */
export type PassSession = { label: string; title: string }

type Props = {
  passId: string
  name: string
  college: string
  tier: Tier
  tierName: string
  /** Chosen at registration: the technical session, and the workshop on Premium and above. */
  sessions: PassSession[]
}


/** "30 OCT", from the one date in content/event.ts. */
const DAY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
  .format(new Date(event.startsAt))
  .toUpperCase()

/**
 * The ticket as the handoff draws it: a rounded ticket with striped ends and
 * side notches, the pass id on top, the QR at the foot. Only a verified pass
 * is ever drawn, so the QR is always there. Marked data-pass-card so
 * printing keeps just this.
 */
export function PassCard({ passId, name, college, tier, tierName, sessions }: Props) {
  return (
    <article data-pass-card="1" className="pass-card" aria-label={`Pass ${passId}`}>
      <span className="pass-decor" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <div className="pass-stripe pass-stripe-top" />
      <span className="pass-notch pass-notch-l" aria-hidden="true" />
      <span className="pass-notch pass-notch-r" aria-hidden="true" />

      <div className="pass-block pass-block-center">
        <span className="lbl-sm">Pass ID</span>
        <span className="num-lg">{passId}</span>
        <span className="pass-tier" data-tier-fill={tier}>
          {tierName.toUpperCase()}
        </span>
      </div>

      <div className="pass-block">
        <span className="lbl-sm">Attendee</span>
        <span className="pass-val">{name}</span>
        <span className="hint">{college}</span>
      </div>

      <div className="pass-cols">
        <div>
          <span className="lbl-sm">Date</span>
          <span className="pass-val-num">{DAY}</span>
        </div>
        <div>
          <span className="lbl-sm">Doors</span>
          <span className="pass-val-num">{doorsLabel}</span>
        </div>
        <div>
          <span className="lbl-sm">Lunch</span>
          <span className="pass-val-sm">Included</span>
        </div>
      </div>

      <div className="pass-block">
        <span className="lbl-sm">Your sessions</span>
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div key={s.label} className="pass-session">
              <span className="num flex-none text-[13px] text-ink">{s.label}</span>
              <span className="text-right text-[13px] leading-snug text-ink">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pass-block">
        <span className="lbl-sm">Place</span>
        <span className="pass-val-sm">{venue.name}</span>
      </div>

      <div className="pass-scan">
        <span className="shout" aria-hidden="true">
          SCAN ME!
        </span>
        <QrPass passId={passId} />
      </div>

      <div className="pass-stripe pass-stripe-bottom" />
    </article>
  )
}
