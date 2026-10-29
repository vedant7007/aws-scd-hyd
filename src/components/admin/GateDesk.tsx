'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ScanResult } from '@/app/api/admin/scan/route'

type Mark = 'checkin' | 'swag' | 'lunch' | 'snack'
const MARKS: { id: Mark; label: string; at: keyof ScanResult }[] = [
  { id: 'checkin', label: 'CHECK IN', at: 'checkedInAt' },
  { id: 'swag', label: 'SWAG GIVEN', at: 'swagIssuedAt' },
  { id: 'lunch', label: 'LUNCH TOKEN', at: 'lunchAt' },
  { id: 'snack', label: 'LIGHT FOOD', at: 'snackAt' },
]

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '')

async function call(passId: string, action: string, what?: Mark): Promise<ScanResult> {
  const res = await fetch('/api/admin/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passId, action, what }) })
  return (await res.json()) as ScanResult
}

/**
 * The gate desk for one pass, opened by scanning its QR with any phone
 * camera while signed in as crew. The name is large because the volunteer
 * copies it onto the ID card. Every mark is one tap, records the time, and
 * can be undone.
 */
export function GateDesk({ passId }: { passId: string }) {
  const [r, setR] = useState<ScanResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    call(passId, 'lookup')
      .then((x) => live && setR(x))
      .catch(() => live && setNote('No connection. Pull down to retry.'))
    return () => {
      live = false
    }
  }, [passId])

  const act = async (action: 'undo' | Mark, what?: Mark) => {
    setBusy(what ?? action)
    setNote(null)
    try {
      const out = await call(passId, action, what)
      setR(out)
      if (out.message) setNote(out.message)
    } catch {
      setNote('No connection. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const a = r?.attendee
  const verified = Boolean(r?.ok)

  return (
    <div className="page rise">
      <div className="flex items-center justify-between gap-3">
        <span className="eye">{'// GATE · '}{passId}</span>
        <Link href="/admin/scan" className="btn btn-mono">
          SCAN NEXT
        </Link>
      </div>

      {!r ? (
        <p className="lede">Looking up {passId}…</p>
      ) : (
        <>
          <div className={verified ? 'gd-verdict' : 'gd-verdict gd-bad'} role="status">
            <span>{verified ? '✓ VERIFIED STUDENT' : '✕ NOT VERIFIED'}</span>
            {!verified && r.message ? <small>{r.message}</small> : null}
          </div>

          {a ? (
            <div className="card flex flex-col gap-3 p-4">
              <span className="lbl">Write on the ID card</span>
              <span className="gd-name">{a.name}</span>
              <div className="flex flex-col">
                {[
                  ['Pass', `${a.tier.toUpperCase()} · ${passId}`],
                  ['College', a.college],
                  ['Group', a.group ? `${a.group.size} people${a.group.payer ? ', paid for the group' : ''}` : 'Solo'],
                  ['Food', a.food ?? 'Not chosen yet'],
                  ['Bus', a.bus ? `${a.bus}${a.busStop ? ` · stop: ${a.busStop}` : ''}` : 'Not chosen yet'],
                  ['Sessions', [a.technical, a.workshop].filter(Boolean).join(' · ')],
                ].map(([k, v]) => (
                  <div key={k} className="row">
                    <span className="lbl">{k}</span>
                    <span className="copy text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {verified ? (
            <div className="gd-marks">
              {MARKS.map((m) => {
                const at = r[m.at] as string | undefined
                return (
                  <div key={m.id} className="gd-mark" data-done={at ? '1' : undefined}>
                    <button type="button" className={at ? 'btn' : 'btn btn-primary'} disabled={busy !== null || Boolean(at)} onClick={() => act(m.id)}>
                      {at ? `✓ ${m.label} · ${time(at)}` : busy === m.id ? '…' : m.label}
                    </button>
                    {at ? (
                      <button type="button" className="gd-undo" disabled={busy !== null} onClick={() => act('undo', m.id)}>
                        undo
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {note ? <p className="hint">{note}</p> : null}
        </>
      )}
    </div>
  )
}
