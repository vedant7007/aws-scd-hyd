import { ROOM_RESERVE, rooms } from '@/content/event'
import { programSessions } from '@/content/program'
import { requireAdmin } from '@/lib/auth/admin'
import { listCrewAudit } from '@/lib/auth/crew'
import { getConfig, getSessions } from '@/lib/db/queries'
import { launchStatus } from '@/lib/tickets/launch'
import { RegistrationSwitch, SessionCapacityForm } from '@/components/admin/Settings'

/**
 * The switches an admin may flip: registration open or closed, and how many
 * seats each technical session and workshop sells. Every change is one
 * transaction with its audit line, and the audit trail is listed
 * underneath. Admin only.
 */
export default async function SettingsPage() {
  await requireAdmin()
  const [launch, config, stored, audit] = await Promise.all([launchStatus(), getConfig(), getSessions(), listCrewAudit(40)])

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
              ? 'New registrations are being accepted. Closing stops new ones only: anyone already paying keeps their payment step until their hold lapses, and verification keeps working.'
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

      <section className="card flex flex-col" aria-labelledby="seats-h">
        <div className="card-head">
          <span id="seats-h" className="card-title">
            SEATS PER SESSION
          </span>
          <span className="lbl">held of sellable</span>
        </div>
        <p className="row-body">
          Every registration holds a seat in its technical session, and Premium and above one in a workshop too, from the payment step
          onwards. Nothing sells into a session until it has a number here, and registration will not open until all seven do. A number
          may be lowered only as far as the seats already held. For reference, the rooms seat{' '}
          {rooms.map((r) => `${r.name} ${r.physicalCapacity}`).join(', ')}; keep {ROOM_RESERVE} back in each for speakers and crew.
        </p>
        {programSessions.map((p, i) => {
          const item = stored[i]
          return (
            <div key={p.id} className="flex flex-col gap-3 border-t border-line-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="lbl">
                    {p.code} · {p.level}
                  </span>
                  <span className="h3">{p.title}</span>
                </span>
                <span className="num text-ink">{item ? `${item.seatsTaken} of ${item.sellableCapacity ?? '-'}` : 'not sized'}</span>
              </div>
              <SessionCapacityForm sessionId={p.id} current={item?.sellableCapacity ?? null} />
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
