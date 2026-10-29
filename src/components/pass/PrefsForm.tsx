'use client'

import { useState } from 'react'
import { BUS_ROUTES, FOOD, OWN_TRANSPORT, TRANSPORT_PDF, type Food } from '@/content/transport'

type Props = { passId: string; food: Food | null; busRoute: string | null; busStop: string | null }

/**
 * Food and college bus, on the ticket page, above the QR. Saved straight to
 * the record; it can be changed any time until the day. Not required for
 * entry: the QR works either way.
 */
export function PrefsForm({ passId, food: f0, busRoute: r0, busStop: s0 }: Props) {
  const [food, setFood] = useState<Food | null>(f0)
  const [route, setRoute] = useState(r0 ?? '')
  const [stop, setStop] = useState(s0 ?? '')
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ kind: f0 && r0 ? 'saved' : 'idle' })
  const onBus = route !== '' && route !== OWN_TRANSPORT

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!food) return setState({ kind: 'error', message: 'Pick veg or non-veg.' })
    if (!route) return setState({ kind: 'error', message: 'Pick your bus route, or own transport.' })
    if (onBus && stop.trim().length < 2) return setState({ kind: 'error', message: 'Type the stop you will board at.' })
    setState({ kind: 'saving' })
    try {
      const res = await fetch(`/api/pass/${passId}/prefs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ food, busRoute: route, busStop: stop }) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      setState(data.ok ? { kind: 'saved' } : { kind: 'error', message: data.message ?? 'Could not save. Try again.' })
    } catch {
      setState({ kind: 'error', message: 'No connection. Try again.' })
    }
  }

  return (
    <form id="prefs" onSubmit={save} className="card flex flex-col gap-4 p-4" data-saved={state.kind === 'saved' ? '1' : undefined}>
      <div className="flex flex-col gap-1">
        <span className="lbl eye-amber">{state.kind === 'saved' ? '✓ Saved · you can change it until the day' : 'Two quick questions'}</span>
        <span className="h3">FOOD &amp; COLLEGE BUS</span>
      </div>

      <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
        <legend className="lbl mb-2">Your lunch</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FOOD) as Food[]).map((k) => (
            <button key={k} type="button" className={food === k ? 'btn btn-primary' : 'btn'} aria-pressed={food === k} onClick={() => { setFood(k); setState({ kind: 'idle' }) }}>
              {FOOD[k].toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="lbl">Coming by college bus?</span>
        <select className="inp" value={route} onChange={(e) => { setRoute(e.target.value); setState({ kind: 'idle' }) }}>
          <option value="">Pick one</option>
          <option value={OWN_TRANSPORT}>No, I will come on my own</option>
          {BUS_ROUTES.map((r) => (
            <option key={r.no} value={r.no}>
              Route {r.no} · {r.area} · starts {r.starts}
            </option>
          ))}
        </select>
      </label>

      {onBus ? (
        <label className="flex flex-col gap-2">
          <span className="lbl">The stop you will board at</span>
          <input className="inp" value={stop} maxLength={60} placeholder="e.g. Miyapur X Roads" onChange={(e) => { setStop(e.target.value); setState({ kind: 'idle' }) }} />
        </label>
      ) : null}

      <a href={TRANSPORT_PDF} target="_blank" rel="noopener" className="hint">
        See every route, its start time and the driver&apos;s number (PDF) →
      </a>

      {state.kind === 'error' ? (
        <p role="alert" className="notice-err">
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={state.kind === 'saving'}>
        {state.kind === 'saving' ? 'SAVING…' : state.kind === 'saved' ? 'SAVED ✓' : 'SAVE MY CHOICES'}
      </button>
    </form>
  )
}
