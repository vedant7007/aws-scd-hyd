'use client'

import { useEffect, useState } from 'react'
import { ALONGSIDE, SCHEDULE, clock, type SlotKind } from '@/content/schedule'
import { EVENT_DAY } from '@/content/program'

const KIND: Record<SlotKind, string> = {
  gate: 'CHECK-IN',
  ceremony: 'CEREMONY',
  talk: 'TECH TALK',
  break: 'BREAK',
  workshop: 'HANDS-ON',
  panel: 'PANEL',
  fun: 'FUN',
}

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}

/** Minutes past midnight in Hyderabad, or null on any day but the event's. */
function nowOnEventDay(): number | null {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  if (`${get('year')}-${get('month')}-${get('day')}` !== EVENT_DAY) return null
  return Number(get('hour')) * 60 + Number(get('minute'))
}

/**
 * The timeline. On the event day it marks what is on now, dims what is over
 * and names what is next, re-checking every thirty seconds. Rendered on the
 * server without any of that, so it reads fine with JavaScript off.
 */
export function LiveSchedule() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(nowOnEventDay())
    const first = setTimeout(tick, 0)
    const every = setInterval(tick, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [])

  const onIdx = now === null ? -1 : SCHEDULE.findIndex((s) => now >= mins(s.start) && now < mins(s.end))
  const nextIdx = now === null ? -1 : SCHEDULE.findIndex((s) => mins(s.start) > now)
  const on = SCHEDULE[onIdx]
  const next = SCHEDULE[nextIdx]
  const over = now !== null && now >= mins(SCHEDULE[SCHEDULE.length - 1]!.end)

  return (
    <>
      {now !== null && (
        <div className="sc-live" aria-live="polite">
          {over ? (
            <span className="sc-live-t">THAT&apos;S A WRAP. THANK YOU FOR COMING.</span>
          ) : (
            <>
              {on && (
                <span className="sc-live-t">
                  <span className="sc-pulse" aria-hidden="true" />
                  ON NOW: {on.title}
                  {on.venue ? ` · ${on.venue}` : ''} · until {clock(on.end)}
                </span>
              )}
              {next && (
                <span className="sc-live-n">
                  UP NEXT {clock(next.start)}: {next.title}
                </span>
              )}
            </>
          )}
        </div>
      )}

      <ol className="sc-list">
        {SCHEDULE.map((s, i) => {
          const state = i === onIdx ? 'now' : now !== null && now >= mins(s.end) ? 'past' : undefined
          return (
            <li key={s.start + s.title} className="sc-row" data-kind={s.kind} data-state={state}>
              <div className="sc-time">
                <span className="sc-start">{clock(s.start)}</span>
                <span className="sc-end">to {clock(s.end)}</span>
              </div>
              <div className="sc-rail" aria-hidden="true">
                <span className="sc-node" />
              </div>
              <div className="sc-card">
                <div className="sc-top">
                  <span className="sc-kind">{KIND[s.kind]}</span>
                  {state === 'now' && <span className="sc-now">ON NOW</span>}
                  <span className="sc-dur">{mins(s.end) - mins(s.start)} MIN</span>
                </div>
                <h3 className="sc-title">{s.title}</h3>
                {s.venue && <span className="sc-venue">{s.venue}</span>}
                {s.people.length > 0 && (
                  <ul className="sc-people">
                    {s.people.map((p) => (
                      <li key={p.name}>
                        <b>{p.name}</b>
                        <span>{p.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.note && <p className="sc-note">{s.note}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="sc-along">
        <span className="sc-kind">ALL AFTERNOON</span>
        <h3 className="sc-title">{ALONGSIDE.title}</h3>
        <p className="copy">
          {clock(ALONGSIDE.start)} to {clock(ALONGSIDE.end)} · {ALONGSIDE.venue}. Walk in any time between sessions.
        </p>
      </div>
    </>
  )
}
