'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { REFERRAL_CUTOFF, ordinal, score } from '@/content/referral'
import type { BoardRow } from '@/lib/referral/store'

/**
 * The referral arcade: the cabinet the leaderboard lives in, its podium, its
 * score table and the countdown to the cutoff. One look, used on the
 * leaderboard page and, smaller, on the home page.
 */

/** DD:HH:MM:SS to the cutoff, ticking. GAME OVER after it. */
export function Countdown() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // Time only exists in the browser; the server renders the placeholder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = now === null ? null : Math.max(0, Date.parse(REFERRAL_CUTOFF) - now)
  if (left === 0) return <span className="arc-clock" data-over="1">GAME OVER</span>
  const parts = left === null ? ['--', '--', '--', '--'] : [86_400_000, 3_600_000, 60_000, 1000].map((u, i, all) => String(Math.floor((i ? left % all[i - 1]! : left) / u)).padStart(2, '0'))
  return (
    <span className="arc-clock" role="timer" aria-label="Time left to refer">
      {parts.map((p, i) => (
        <span key={i} className="arc-clock-cell">
          <b>{p}</b>
          <small>{['DAYS', 'HRS', 'MIN', 'SEC'][i]}</small>
        </span>
      ))}
    </span>
  )
}

/** Second, first, third, left to right, each on a block as tall as their score. Empty spots invite the next player. */
export function Podium({ rows, small = false }: { rows: BoardRow[]; small?: boolean }) {
  const top = Math.max(1, ...rows.slice(0, 3).map((r) => r.count))
  const spot = (rank: number) => rows[rank - 1]
  return (
    <div className="arc-podium" data-small={small ? '1' : undefined}>
      {[2, 1, 3].map((rank) => {
        const r = spot(rank)
        const h = r ? 0.45 + 0.55 * (r.count / top) : 0.3
        return (
          <div key={rank} className="arc-spot" data-rank={rank} data-empty={r ? undefined : '1'} style={{ '--h': h } as CSSProperties}>
            <div className="arc-who">
              {rank === 1 && r ? <span className="arc-crown" aria-hidden="true" /> : null}
              <span className="arc-name">{r ? r.name : 'YOU?'}</span>
              <span className="arc-col">{r ? r.college : 'free spot'}</span>
            </div>
            <div className="arc-block">
              <span className="arc-place">{ordinal(rank)}</span>
              <span className="arc-pts">{r ? score(r.count) : '000'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Everyone after the podium, arcade style: place, name, college, score. */
export function ScoreTable({ rows, from = 4 }: { rows: BoardRow[]; from?: number }) {
  const rest = rows.slice(from - 1)
  if (!rest.length) return null
  return (
    <ol className="arc-table" start={from}>
      {rest.map((r) => (
        <li key={r.code} className="arc-row">
          <span className="arc-row-rank">{ordinal(r.rank)}</span>
          <span className="arc-row-name">{r.name}</span>
          <span className="arc-row-col">{r.college}</span>
          <span className="arc-row-pts">{score(r.count)}</span>
        </li>
      ))}
    </ol>
  )
}
