import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PassCard, type PassSession } from '@/components/pass/PassCard'
import { SlotPicker, type PickerSlot } from '@/components/pass/SlotPicker'
import { doorsLabel, event, slots as fallbackSlots, venue } from '@/content/event'
import { tierLabel, tracksAllowedFor } from '@/content/passes'
import { roomById, trackName } from '@/content/sessions'
import { tracks } from '@/content/tracks'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee, getAttendeeWithSeats, getConfig, getSessionsInSlot } from '@/lib/db/queries'
import { REPLY_TO } from '@/lib/email/templates'
import { sessionsAreReleased } from '@/lib/registration/flow'
import { slotTime } from '@/lib/utils'

/** A pass is private. It must never be indexed or appear in the sitemap. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

/** Lookups hit the table on every request, never a cached render. */
export const dynamic = 'force-dynamic'

/** "30TH" from the one date in content/event.ts. */
const DAY_ORDINAL = (() => {
  const d = new Date(event.startsAt).getDate()
  const suffix = d % 10 === 1 && d !== 11 ? 'ST' : d % 10 === 2 && d !== 12 ? 'ND' : d % 10 === 3 && d !== 13 ? 'RD' : 'TH'
  return `${d}${suffix}`
})()

const firstName = (name: string) => (name.trim().split(/\s+/)[0] ?? name).toUpperCase()

/**
 * Amendment 1 section 4, the state table.
 *
 *   AWAITING_PAYMENT, PENDING_VERIFICATION, ABANDONED, REJECTED, unknown
 *       the same not-found page, so nothing about the record leaks
 *   VERIFIED, sessions not released
 *       name, pass id, tier, home track, "agenda coming soon". No QR.
 *   VERIFIED, sessions released
 *       the per-slot picker. Still no QR.
 *   SESSIONS_SELECTED
 *       the full pass: QR, the four sessions, food. Read only.
 */
export default async function PassPage({ params }: PageProps<'/pass/[passId]'>) {
  const { passId: raw } = await params
  const canonical = normalisePassId(raw)
  if (!canonical) notFound()
  // One URL per pass. A lowercase or unhyphenated link lands on the real one.
  if (canonical !== raw) redirect(`/pass/${canonical}`)

  // By key, strongly consistent: a student opening the link the second after a verify sees VERIFIED, not the index catching up.
  const attendee = await getAttendee(canonical)
  if (!attendee || (attendee.state !== 'VERIFIED' && attendee.state !== 'SESSIONS_SELECTED')) notFound()

  const [config, released] = await Promise.all([getConfig(), sessionsAreReleased()])
  const slotList = config?.slots ?? fallbackSlots
  const allowed = tracksAllowedFor(attendee.tier)
  const allowedTracks =
    allowed >= tracks.length
      ? 'all three tracks'
      : allowed === 1
        ? `the ${trackName(attendee.homeTrack)} track`
        : `${trackName(attendee.homeTrack)} plus one other track`

  const card = (extra: { sessions?: PassSession[]; showQr: boolean; sessionsNote?: string }) => (
    <PassCard
      passId={attendee.passId}
      name={attendee.name}
      college={attendee.college}
      tier={attendee.tier}
      tierName={tierLabel(attendee.tier)}
      trackName={trackName(attendee.homeTrack)}
      food={attendee.foodPreference}
      {...extra}
    />
  )

  if (attendee.state === 'VERIFIED') {
    if (!released) {
      return (
        <div className="page rise">
          <div className="flex flex-col gap-2">
            <span className="eye">{'// YOU ARE IN'}</span>
            <h1 className="h1">
              SEE YOU ON THE {DAY_ORDINAL}, {firstName(attendee.name)}
            </h1>
            <p className="lede">Agenda coming soon. We will email you when you can pick your sessions.</p>
          </div>
          {card({ showQr: false, sessionsNote: 'Not open yet' })}
          <p className="hint">Keep this link. It is in your confirmation email, and it becomes your ticket once you have picked your sessions.</p>
        </div>
      )
    }

    const slotSessions = await Promise.all(slotList.map((slot) => getSessionsInSlot(slot.id)))
    const order = (t: string) => tracks.findIndex((x) => x.id === t)
    const pickerSlots: PickerSlot[] = slotList.map((slot, i) => ({
      slotId: slot.id,
      label: slot.label,
      time: slotTime(slot),
      sessions: [...slotSessions[i]!]
        .sort((a, b) => order(a.track) - order(b.track))
        .map((s) => ({
          sessionId: s.sessionId,
          track: s.track,
          trackName: trackName(s.track),
          title: s.title,
          speaker: s.speaker,
          roomName: roomById(s.roomId)?.name ?? null,
          seatsTaken: s.seatsTaken,
          sellableCapacity: s.sellableCapacity,
          // Regular: home track only. Premium: any track, one other, held at submit. Platinum, VIP: all.
          allowed: allowed > 1 || s.track === attendee.homeTrack,
        })),
    }))

    return (
      <div className="page page-bar rise">
        <div className="flex flex-col gap-2">
          <span className="eye">{'// PICK YOUR SESSIONS'}</span>
          <h1 className="h1">{firstName(attendee.name)}, BUILD YOUR DAY</h1>
          <p className="lede">
            Pass ID <span className="num text-ink">{attendee.passId}</span>. Pick one session in each slot, then save. Your seat in each
            is held from that moment.
          </p>
        </div>
        <SlotPicker passId={attendee.passId} slots={pickerSlots} allowedTracks={allowedTracks} />
      </div>
    )
  }

  // SESSIONS_SELECTED: the finished pass.
  const [{ seats }, ...slotSessions] = await Promise.all([
    getAttendeeWithSeats(attendee.passId),
    ...slotList.map((s) => getSessionsInSlot(s.id)),
  ])
  const chosen = slotList.map((slot, i) => {
    const seat = seats.find((s) => s.slotId === slot.id)
    return { slot, session: seat ? slotSessions[i]!.find((s) => s.sessionId === seat.sessionId) : undefined }
  })
  const sessions: PassSession[] = chosen.map(({ slot, session }) => ({
    slotLabel: slot.label,
    time: slotTime(slot),
    track: session?.track ?? attendee.homeTrack,
    title: session ? (session.title ?? `${trackName(session.track)}, title announced soon`) : 'Session missing, write to us',
  }))

  return (
    <div className="page rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// THIS LINK IS YOUR TICKET'}</span>
        <h1 className="h1">
          SEE YOU ON THE {DAY_ORDINAL}, {firstName(attendee.name)}
        </h1>
        <p className="lede">Screenshot this page. It works with no signal at the gate, and you do not need to log in anywhere.</p>
      </div>

      {card({ showQr: true, sessions })}

      <div className="flex flex-wrap gap-2.5">
        <a href={venue.directionsUrl} className="btn flex-[1_1_150px]">
          GATE PIN
        </a>
        <Link href={`/pass/${attendee.passId}/share`} className="btn flex-[1_1_150px]">
          TELL PEOPLE
        </Link>
      </div>

      <section aria-labelledby="sessions-heading" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="sessions-heading" className="h2">
            YOUR DAY
          </h2>
          <span className="lbl">{chosen.length} sessions, one per slot</span>
        </div>
        <div className="ag-card">
          {chosen.map(({ slot, session }) => (
            <div key={slot.id} className="ag-row">
              <span className="ag-time">
                {slot.label}
                {slotTime(slot) ? <span className="ag-time-tbc block">{slotTime(slot)}</span> : null}
              </span>
              <span className="ag-cell">
                <span className="ag-title">
                  {session ? (session.title ?? `${trackName(session.track)}, title announced soon`) : 'Session missing, write to us'}
                </span>
                <span className="ag-sub">
                  {session ? `${trackName(session.track)} · ${roomById(session.roomId)?.name ?? 'room announced soon'}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="hint">
          Your choices are saved and cannot be changed here. If you need a change, write to the organisers at {REPLY_TO} quoting your
          pass ID.
        </p>
      </section>

      <div className="card-dash flex flex-col gap-2.5 px-4 py-4">
        <span className="lbl eye-amber">On the day</span>
        <p className="copy">Doors at {doorsLabel}. The pin above is the gate.</p>
        <p className="copy">Turn your screen brightness up before you reach the volunteer. Sunlight kills scanner reads.</p>
        <p className="copy">Lost this link? It is in your confirmation email.</p>
        <Link href="/code-of-conduct#report" className="btn btn-mono self-start">
          Something wrong with your pass? Report it
        </Link>
      </div>

    </div>
  )
}
