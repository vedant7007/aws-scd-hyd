import { doorsLabel, event, venue } from '@/content/event'
import type { FoodPreference, Tier, Track } from '@/lib/db/types'
import { QrPass } from './QrPass'

export type PassSession = {
  slotLabel: string
  time: string | null
  track: Track
  title: string
}

type Props = {
  passId: string
  name: string
  college: string
  tier: Tier
  tierName: string
  trackName: string
  food: FoodPreference
  /** The four chosen sessions, once chosen. */
  sessions?: PassSession[]
  /** Only the final state carries the code. Amendment 1 section 4. */
  showQr: boolean
  /** What the sessions line says while there is nothing to list. */
  sessionsNote?: string
}

export const FOOD_LABEL: Record<FoodPreference, string> = { veg: 'Veg', nonveg: 'Non-veg', jain: 'Jain' }

/** "30 OCT", from the one date in content/event.ts. */
const DAY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
  .format(new Date(event.startsAt))
  .toUpperCase()

/**
 * The pass as the handoff draws it: a rounded ticket with striped ends and
 * side notches, the pass id on top, the QR at the foot. The same object in
 * every state so nothing about it is a surprise on the day; the states only
 * add to it. Marked data-pass-card so printing keeps just this.
 */
export function PassCard({ passId, name, college, tier, tierName, trackName, food, sessions, showQr, sessionsNote }: Props) {
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
          <span className="lbl-sm">Food</span>
          <span className="pass-val-sm">{FOOD_LABEL[food]}</span>
        </div>
      </div>

      <div className="pass-block">
        <span className="lbl-sm">Track</span>
        <span className="pass-val-sm">{trackName}</span>
      </div>

      <div className="pass-block">
        <span className="lbl-sm">Your sessions</span>
        {sessions ? (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div key={s.slotLabel} className="pass-session">
                <span className="num flex-none text-[13px] text-ink">
                  {s.time ?? s.slotLabel}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="dot dot-sm dot-round" data-track={s.track} aria-hidden="true" />
                  <span className="text-right text-[13px] leading-snug text-ink">{s.title}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="pass-val-sm">{sessionsNote}</span>
        )}
      </div>

      <div className={`pass-block${showQr ? '' : ' pass-block-last'}`}>
        <span className="lbl-sm">Place</span>
        <span className="pass-val-sm">{venue.name}</span>
      </div>

      {showQr ? (
        <div className="pass-scan">
          <span className="shout" aria-hidden="true">
            SCAN ME!
          </span>
          <QrPass passId={passId} />
        </div>
      ) : null}

      <div className="pass-stripe pass-stripe-bottom" />
    </article>
  )
}
