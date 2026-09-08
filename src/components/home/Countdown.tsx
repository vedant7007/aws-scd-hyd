'use client'

import { useEffect, useState } from 'react'

// Each unit is derived from the total independently, so nothing accumulates
// and there is no mutable state to get out of step.
const UNITS = [
  { name: 'days', ms: 86_400_000, wrapAt: Infinity },
  { name: 'hours', ms: 3_600_000, wrapAt: 24 },
  { name: 'minutes', ms: 60_000, wrapAt: 60 },
  { name: 'seconds', ms: 1_000, wrapAt: 60 },
] as const

/**
 * The target carries its own offset, so the difference is the same number
 * wherever the visitor is. Nothing here needs a timezone library.
 *
 * Renders a stable placeholder until it has mounted, because the server cannot
 * know the visitor's clock and a guess would mismatch on hydration.
 */
export function Countdown({ target, label }: { target: string; label: string }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const at = new Date(target).getTime()
    const tick = () => setRemaining(at - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  if (remaining !== null && remaining <= 0) {
    return <p className="display text-step-2">Happening now.</p>
  }

  const total = Math.max(0, remaining ?? 0)
  const parts = UNITS.map(({ name, ms, wrapAt }) => ({
    name,
    value: remaining === null ? null : Math.floor(total / ms) % wrapAt,
  }))

  return (
    <div>
      <p className="text-step--1 text-muted">{label}</p>
      <dl className="mono mt-2 flex flex-wrap gap-x-8 gap-y-2" aria-live="off">
        {parts.map(({ name, value }) => (
          <div key={name} className="flex items-baseline gap-2">
            <dt className="sr-only">{name}</dt>
            <dd className="display text-step-3">{value === null ? '--' : String(value).padStart(2, '0')}</dd>
            <dd className="text-step--1 text-muted">{name}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
