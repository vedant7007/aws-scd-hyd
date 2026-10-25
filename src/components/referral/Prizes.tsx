import Image from 'next/image'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { PRIZES, SPECIAL_LOOT, SPECIAL_PRIZE_AT, ordinal } from '@/content/referral'

/**
 * The referral prizes as an arcade claw machine. The three prizes sit in
 * capsules behind the glass while a pixel claw drifts from one to the next,
 * dips, and the one under it lifts and glows; the cycle never ends. Beside
 * it, the jackpot: the 25+ gamer kit in a gold capsule. No prices, by the
 * organisers' decision.
 */

/** The claw, block by block on a 12 by 10 grid, in currentColor. */
function Claw() {
  const blocks: [number, number, number, number][] = [
    [4, 0, 4, 2],
    [3, 2, 6, 1],
    [2, 3, 2, 1],
    [8, 3, 2, 1],
    [1, 4, 2, 2],
    [9, 4, 2, 2],
    [0, 6, 2, 2],
    [10, 6, 2, 2],
    [1, 8, 2, 1],
    [9, 8, 2, 1],
  ]
  return (
    <svg className="cm-claw-svg" viewBox="0 0 12 9" shapeRendering="crispEdges" aria-hidden="true">
      {blocks.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </svg>
  )
}

export function Prizes({ compact = false }: { compact?: boolean }) {
  return (
    <section className="cm" data-compact={compact ? '1' : undefined} aria-labelledby="cm-h">
      <div className="cm-head">
        <span className="cm-eye">LOOT TABLE</span>
        <h2 id="cm-h" className="cm-h">
          WHAT YOU CAN WIN
        </h2>
      </div>

      <aside className="jp" aria-labelledby="jp-h">
        <span className="jp-lights" aria-hidden="true" />
        <div className="jp-sign">
          <span className="jp-flash">★ JACKPOT ★</span>
          <h3 id="jp-h" className="jp-h">
            <span>{SPECIAL_PRIZE_AT}+</span> REFERRALS
          </h3>
          <p className="jp-p">Bring {SPECIAL_PRIZE_AT} or more friends and the reels pay out the whole gamer kit. Anyone can hit it, and it stacks on a top 3 prize.</p>
        </div>
        <div className="jp-machine">
          <div className="jp-reels">
            {SPECIAL_LOOT.map((l, i) => (
              <div key={l.name} className="jp-reel">
                <span className="jp-window">
                  <span className="jp-strip" style={{ '--i': i } as CSSProperties}>
                    {/* Every item, rotated so this reel stops on its own, then once more to spin through. */}
                    {[...SPECIAL_LOOT.slice(i + 1), ...SPECIAL_LOOT, ...SPECIAL_LOOT.slice(0, i + 1)].map((x, k) => (
                      <span key={k} className="jp-cell">
                        <Image src={x.photo} alt={k === SPECIAL_LOOT.length * 2 - 1 ? l.name : ''} width={1000} height={1000} quality={90} sizes="160px" />
                      </span>
                    ))}
                  </span>
                </span>
                <span className="jp-label">{l.name}</span>
              </div>
            ))}
          </div>
          <span className="jp-lever" aria-hidden="true">
            <i />
          </span>
        </div>
      </aside>

      <div className="cm-wrap">
        <div className="cm-machine">
          <div className="cm-top">
            <span className="cm-bulbs" aria-hidden="true" />
            <span className="cm-brand">CLAW-O-MATIC</span>
            <span className="cm-sub">TOP 3 REFERRERS WIN</span>
          </div>

          <div className="cm-glass">
            <span className="cm-shine" aria-hidden="true" />
            <div className="cm-rail" aria-hidden="true">
              <span className="cm-carriage">
                <span className="cm-cable" />
                <span className="cm-claw">
                  <Claw />
                </span>
              </span>
            </div>
            <ul className="cm-prizes">
              {PRIZES.map((p) => (
                <li key={p.rank} className="cm-prize" data-rank={p.rank}>
                  <span className="cm-capsule">
                    <span className="cm-spin">
                      <span className="cm-face">
                        <Image src={p.photo} alt={p.name} width={1000} height={1000} quality={90} sizes="(max-width: 700px) 30vw, 320px" />
                      </span>
                      <span className="cm-face cm-face-back" aria-hidden="true">
                        <Image src={p.photo} alt="" width={1000} height={1000} quality={90} sizes="(max-width: 700px) 30vw, 320px" />
                      </span>
                    </span>
                  </span>
                  <span className="cm-tag">{ordinal(p.rank)}</span>
                  <span className="cm-name">{p.name}</span>
                  <span className="cm-kind">{p.kind}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="cm-panel">
            <span className="cm-stick" aria-hidden="true">
              <i />
            </span>
            <span className="cm-slot">
              INSERT
              <b>REFERRALS</b>
            </span>
            <Link href="/refer" className="cm-play">
              PLAY
            </Link>
          </div>
        </div>

      </div>

      <p className="cm-fine">Prizes go on payment-verified referrals. The organisers review the top referrals before handing anything over.</p>
    </section>
  )
}
