import { ROOM_RESERVE, rooms } from '@/content/event'
import { EARLY_BIRD_TOTAL } from '@/content/passes'
import { roomById } from '@/content/sessions'
import { tracks } from '@/content/tracks'
import { requireAdmin } from '@/lib/auth/admin'
import { listCrewAudit } from '@/lib/auth/crew'
import { getConfig, getTrackCounters } from '@/lib/db/queries'
import { earlyBirdCounter } from '@/lib/registration/state'
import { launchStatus } from '@/lib/tickets/launch'
import { RegistrationSwitch, TrackRoomForm } from '@/components/admin/Settings'

/**
 * The switches an admin may flip: registration open or closed, and which
 * room a track runs in. Every change is one transaction with its audit
 * line, and the audit trail is listed underneath. Admin only.
 */
export default async function SettingsPage() {
  await requireAdmin()
  const [launch, config, counters, pool, audit] = await Promise.all([launchStatus(), getConfig(), getTrackCounters(), earlyBirdCounter(), listCrewAudit(40)])
  const assignment = config?.roomForTrack ?? {}
  const trackRooms = rooms.filter((r) => r.role === 'track')

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// SETTINGS'}</span>
        <h1 className="h1">SWITCHES</h1>
        <p className="lede">Each change here is written with who made it and when. The trail is at the foot of the page.</p>
      </div>

      <section className="card flex flex-col" aria-labelledby="reg-h">
        <div className="card-head">
          <span id="reg-h" className="card-title">
            REGISTRATION
          </span>
          <span className={launch.registrationOpen ? 'pill' : 'pill pill-err'}>{launch.registrationOpen ? 'Open' : 'Closed'}</span>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <p className="copy">
            {launch.registrationOpen
              ? 'New registrations are being accepted. Closing stops new ones only: anyone already paying keeps their pay page until their hold lapses, and verification, session release and selection all keep working.'
              : 'Nobody new can start a registration. Records made before the close still submit their UTR until their hold lapses, and every pass link keeps working.'}
          </p>
          {launch.enforced && launch.blockers.length ? (
            <p className="err-text">
              The switch is {launch.registrationOpen ? 'open' : 'closed'}, but selling is blocked by the launch guard: {launch.blockers.map((b) => b.code).join(', ')}. See the dashboard.
            </p>
          ) : null}
          {config?.registrationOpenChangedAt ? (
            <p className="hint">
              Last changed {new Date(config.registrationOpenChangedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} by {config.registrationOpenChangedBy}
            </p>
          ) : null}
          <RegistrationSwitch open={launch.registrationOpen} />
        </div>
      </section>

      <section className="card flex flex-col" aria-labelledby="eb-h">
        <div className="card-head">
          <span id="eb-h" className="card-title">
            EARLY BIRD
          </span>
          <span className="lbl">{EARLY_BIRD_TOTAL} places, all tiers</span>
        </div>
        <div className="row">
          <span className="copy">Claimed</span>
          <span className="stat-val stat-val-sm">{pool ? pool.claimed : 'not created'}</span>
        </div>
        <div className="row">
          <span className="copy">Left</span>
          <span className="stat-val stat-val-sm" data-tone={pool && pool.ceiling - pool.claimed > 0 ? 'ok' : undefined}>
            {pool ? Math.max(0, pool.ceiling - pool.claimed) : '-'}
          </span>
        </div>
        <p className="row-body">
          The pool is created the first time registration is opened and never reset. A place is claimed in the same transaction as the
          registration and given back when the registration is abandoned.
        </p>
      </section>

      <section className="card flex flex-col" aria-labelledby="rooms-h">
        <div className="card-head">
          <span id="rooms-h" className="card-title">
            ROOMS
          </span>
          <span className="lbl">{ROOM_RESERVE} seats held back in every room</span>
        </div>
        <p className="row-body">
          The room may change; the ceiling may only be raised. A room that sells fewer seats than a track already has registered is
          refused, and the refusal names the count.
        </p>
        {tracks.map((t) => {
          const counter = counters.find((c) => c?.track === t.id)
          const room = roomById(assignment[t.id])
          return (
            <div key={t.id} className="flex flex-col gap-3 border-t border-line-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="dot" data-track={t.id} aria-hidden="true" />
                  <span className="h3">{t.name.toUpperCase()}</span>
                </span>
                <span className="lbl">
                  {room ? `${room.name}, sells ${room.physicalCapacity - ROOM_RESERVE}` : 'no room'} · {counter ? `${counter.registered} of ${counter.ceiling ?? 'no ceiling'} registered` : 'counter not seeded'}
                </span>
              </div>
              <TrackRoomForm track={t.id} current={assignment[t.id] ?? ''} rooms={trackRooms.map((r) => ({ id: r.id, label: `${r.name}, ${r.physicalCapacity} seats, sells ${r.physicalCapacity - ROOM_RESERVE}` }))} />
            </div>
          )
        })}
      </section>

      <section className="card flex flex-col" aria-labelledby="audit-h">
        <div className="card-head">
          <span id="audit-h" className="card-title">
            AUDIT TRAIL
          </span>
          <span className="lbl">newest first</span>
        </div>
        {audit.length === 0 ? <p className="row-body">Nothing recorded yet.</p> : null}
        {audit.map((a) => (
          <div key={a.SK} className="row row-top">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="copy">
                <span className="num text-ink">{a.action}</span> {a.target}
                {a.role ? ` as ${a.role}` : ''}
                {a.detail ? `, ${a.detail}` : ''}
              </span>
              <span className="hint">by {a.by}</span>
            </span>
            <span className="num flex-none text-[11px] text-muted">{new Date(a.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
