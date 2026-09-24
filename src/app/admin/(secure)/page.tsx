import Link from 'next/link'
import { AdminConsole, type Row, type SlotOption } from '@/components/admin/AdminConsole'
import { slots as fallbackSlots } from '@/content/event'
import { formatInr, tierLabel } from '@/content/passes'
import { roomById, sessionSpecs, trackName } from '@/content/sessions'
import { requireAdmin } from '@/lib/auth/admin'
import { getAttendeeWithSeats, getConfig } from '@/lib/db/queries'
import { loadDashboard } from '@/lib/db/stats'
import type { FoodPreference, Tier, Track } from '@/lib/db/types'
import { earlyBirdCounter } from '@/lib/registration/state'
import { launchStatus } from '@/lib/tickets/launch'
import { slotLabel } from '@/lib/utils'

const FOOD_LABEL: Record<FoodPreference, string> = { veg: 'Veg', nonveg: 'Non-veg' }
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

function Stat({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: 'ok' | 'warn' | 'err' }) {
  return (
    <div className="stat-card">
      <span className="lbl">{label}</span>
      <span className="stat-val" data-tone={tone}>
        {value}
      </span>
      {note ? <span className="hint">{note}</span> : null}
    </div>
  )
}

/**
 * The handoff's Admin Dashboard, on the six-state lifecycle. Admin only:
 * requireAdmin runs before a single read. The verification queue comes
 * first because a student waiting on it cannot wait; every other number
 * can. Built to be read on a phone, one column, nothing that scrolls
 * sideways except the one table that is genuinely a table.
 */
export default async function AdminDashboardPage() {
  // Guard first. Nothing below runs for a refused, signed out or volunteer caller.
  await requireAdmin()
  const [d, launch, pool] = await Promise.all([loadDashboard(), launchStatus(), earlyBirdCounter()])

  // Held sessions for the selected ones, so an admin can see and change them.
  const held = new Map<string, Record<string, string>>()
  await Promise.all(
    d.attendees
      .filter((a) => a.state === 'SESSIONS_SELECTED')
      .map(async (a) => {
        const { seats } = await getAttendeeWithSeats(a.passId)
        held.set(a.passId, Object.fromEntries(seats.map((s) => [s.slotId, s.sessionId])))
      }),
  )

  const rows: Row[] = d.attendees.map((a) => ({
    passId: a.passId,
    name: a.name,
    email: a.email,
    college: a.college,
    tier: a.tier,
    tierName: tierLabel(a.tier),
    trackName: trackName(a.homeTrack),
    state: a.state,
    amountLabel: formatInr(a.amountPaise),
    earlyBird: a.earlyBird === true,
    utr: a.utr ?? null,
    utrSubmittedAt: a.utrSubmittedAt ?? null,
    screenshot: Boolean(a.screenshotKey),
    rejectionReason: a.rejectionReason ?? null,
    createdAt: a.createdAt,
    held: held.get(a.passId) ?? {},
    checkedIn: Boolean(a.checkedInAt),
  }))

  const slotList = (await getConfig())?.slots ?? fallbackSlots
  const specs = sessionSpecs()
  const slotOptions: SlotOption[] = slotList.map((slot, i) => ({
    slotId: slot.id,
    label: slotLabel(slot, i),
    sessions: specs
      .filter((sp) => sp.slotId === slot.id)
      .map((sp) => ({
        sessionId: sp.sessionId,
        slotId: slot.id,
        label: `${trackName(sp.track)}${sp.title ? `, ${sp.title}` : ''}${roomById(sp.roomId) ? `, ${roomById(sp.roomId)!.name}` : ''}`,
      })),
  }))

  const tiers: Tier[] = ['basic', 'premium', 'ultra', 'vip']
  const tracksInOrder: Track[] = ['ai', 'cloud', 'career']
  const sessionsByTrack = tracksInOrder.map((t) => ({ track: t, list: d.sessions.filter((s) => s.track === t) }))

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex flex-col gap-2">
          <span className="eye">{'// EVERYTHING, EDITABLE'}</span>
          <h1 className="h1">ADMIN DASHBOARD</h1>
        </div>
        <span className="flex items-center gap-2 lbl">
          <span className="dot dot-sm pulse" data-tone="ok" aria-hidden="true" />
          Live from the table on every load
        </span>
      </div>

      {/* Can the site take money, and if not, why. Before anything else on the page. */}
      <section className="flex flex-col gap-3" aria-labelledby="selling-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="selling-h" className="h2">
            SELLING
          </h2>
          <Link href="/admin/settings" className="btn btn-mono">
            Switches and rooms
          </Link>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          <Stat label="Registration switch" value={launch.registrationOpen ? 'OPEN' : 'CLOSED'} tone={launch.registrationOpen ? 'ok' : 'err'} />
          <Stat label="Checkout" value={launch.open ? 'ACCEPTING' : 'REFUSING'} tone={launch.open ? 'ok' : 'err'} note={`${launch.mode} mode`} />
          <Stat label="Launch blockers" value={launch.blockers.length} tone={launch.blockers.length ? 'warn' : 'ok'} />
          <Stat label="Early bird left" value={pool ? Math.max(0, pool.ceiling - pool.claimed) : '-'} note={pool ? `${pool.claimed} of ${pool.ceiling} claimed` : 'pool not created'} />
        </div>
        {launch.blockers.length ? (
          <div className="notice-err" role="status">
            <span className="notice-title">{launch.enforced ? 'SELLING IS BLOCKED' : 'WOULD BLOCK IN PRODUCTION'}</span>
            <ul className="checklist crosslist">
              {launch.blockers.map((b) => (
                <li key={b.code}>{b.detail}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="hint">Nothing stands between the switch and real students in {launch.mode} mode.</p>
        )}
      </section>

      {/* The queue. Every other number on this page can wait; a student waiting on a verification cannot. */}
      <section className="flex flex-col gap-3" aria-labelledby="queue-h">
        <h2 id="queue-h" className="h2">
          REGISTRATIONS
        </h2>
        <AdminConsole rows={rows} slots={slotOptions} sessionsReleased={d.sessionsReleased} />
      </section>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <section className="card flex flex-col" aria-labelledby="tracks-h">
          <div className="card-head">
            <span id="tracks-h" className="card-title">
              TRACK COUNTERS
            </span>
            <span className="lbl">counted at step one</span>
          </div>
          {d.trackLoad.map((t) => {
            const pct = t.ceiling ? Math.min(100, Math.round((t.registered / t.ceiling) * 100)) : 0
            const tone = !t.seeded || t.ceiling === null ? 'err' : t.registered >= t.ceiling ? 'err' : t.ceiling - t.registered < 15 ? 'warn' : undefined
            return (
              <div key={t.track} className="flex flex-col gap-2 border-b border-line-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="dot" data-track={t.track} aria-hidden="true" />
                    <span className="h3">{t.trackName.toUpperCase()}</span>
                  </span>
                  <span className="num text-[15px] font-semibold text-ink">{t.seeded ? `${t.registered} / ${t.ceiling ?? 'no ceiling'}` : 'not seeded'}</span>
                </div>
                <span className="meter">
                  <span data-tone={tone} style={{ width: `${pct}%` }} />
                </span>
              </div>
            )
          })}
          <p className="row-body">A track at its ceiling refuses new registrations before the payment screen. Abandoned registrations give their place back.</p>
        </section>

        <section className="card flex flex-col" aria-labelledby="tier-h">
          <div className="card-head">
            <span id="tier-h" className="card-title">
              BY TIER
            </span>
            <span className="lbl">{d.total} records</span>
          </div>
          {tiers.map((tier) => {
            const n = d.byTier.find((t) => t.tier === tier)?.count ?? 0
            const pct = d.total ? Math.round((n / d.total) * 100) : 0
            return (
              <div key={tier} className="flex flex-col gap-2 border-b border-line-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="dot" data-tier={tier} aria-hidden="true" />
                    <span className="h3">{tierLabel(tier).toUpperCase()}</span>
                  </span>
                  <span className="num text-[17px] font-semibold text-ink">{n}</span>
                </div>
                <span className="meter">
                  <span data-tone="orange" style={{ width: `${pct}%` }} />
                </span>
              </div>
            )
          })}
        </section>

        <section className="card flex flex-col" aria-labelledby="totals-h">
          <div className="card-head">
            <span id="totals-h" className="card-title">
              THE DAY
            </span>
            <span className="lbl">verified and coming: {d.paid}</span>
          </div>
          <div className="row">
            <span className="copy">Awaiting verification</span>
            <span className="stat-val stat-val-sm" data-tone={d.awaitingVerification ? 'warn' : undefined}>
              {d.awaitingVerification}
            </span>
          </div>
          <div className="row">
            <span className="copy">Checked in</span>
            <span className="stat-val stat-val-sm">{d.checkedIn}</span>
          </div>
          <div className="row">
            <span className="copy">Swag issued</span>
            <span className="stat-val stat-val-sm">{d.swagIssued}</span>
          </div>
          <div className="row">
            <span className="copy">Total records</span>
            <span className="stat-val stat-val-sm">{d.total}</span>
          </div>
        </section>

        <section className="card flex flex-col" aria-labelledby="food-h">
          <div className="card-head">
            <span id="food-h" className="card-title">
              FOOD FOR THE CATERER
            </span>
            {/* This number goes to the caterer, so it has to leave the screen. */}
            <a className="btn btn-primary btn-sm" href="/api/admin/food-csv" download>
              EXPORT CSV
            </a>
          </div>
          {d.byFood.map((f) => (
            <div key={f.food} className="row">
              <span className="h3">{FOOD_LABEL[f.food].toUpperCase()}</span>
              <span className="stat-val stat-val-sm" data-tone={f.food === 'veg' ? 'ok' : 'err'}>
                {f.count}
              </span>
            </div>
          ))}
          <p className="row-body">Counts verified attendees only, so rejections and abandoned registrations are not catered for. Send the final count the night before.</p>
        </section>

        <section className="card flex flex-col" aria-labelledby="notify-h">
          <div className="card-head">
            <span id="notify-h" className="card-title">
              NOTIFY LIST
            </span>
            {/* Everyone who asked to be told when registrations open. */}
            <a className="btn btn-primary btn-sm" href="/api/admin/notify-csv" download>
              EXPORT CSV
            </a>
          </div>
          <p className="row-body">
            Addresses left on the closed registration page, newest first, with the passes each person said they were eyeing. Write to this list the day registrations open.
          </p>
        </section>
      </div>

      <section className="card flex flex-col" aria-labelledby="seats-h">
        <div className="card-head">
          <span id="seats-h" className="card-title">
            SEATS PER SESSION
          </span>
          <span className="lbl">sold of sellable, per slot</span>
        </div>
        <p className="row-body">
          Sold counts every seat held, by paid and pending records alike, because a pending record holds a real seat until it is verified or
          its hold lapses. Sellable is what selection may claim, physical is the room, reserve is the difference. A dash is a value not yet
          decided.
        </p>
        {sessionsByTrack.map(({ track, list }) => {
          const tight = Math.min(...list.map((s) => s.free ?? Infinity))
          return (
            <div key={track} className="flex flex-col gap-3 border-t border-line-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="dot" data-track={track} aria-hidden="true" />
                  <span className="h3">{trackName(track).toUpperCase()}</span>
                </span>
                <span className="lbl" data-tone={tight === 0 ? 'err' : undefined}>
                  {list[0]?.roomName ?? 'no room'}
                  {Number.isFinite(tight) ? ` · ${tight === 0 ? 'a session is full' : `${tight} free at tightest`}` : ''}
                </span>
              </div>
              <div className="flex gap-1.5">
                {list.map((s) => {
                  const pct = s.sellable ? Math.min(100, Math.round((s.sold / s.sellable) * 100)) : 0
                  const left = s.sellable === null ? null : Math.max(0, s.sellable - s.sold)
                  return (
                    <span key={s.sessionId} className="flex flex-1 flex-col gap-1">
                      <span className="meter-v">
                        <span data-tone={left === 0 ? 'err' : left !== null && left < 15 ? 'warn' : undefined} style={{ height: `${pct}%` }} />
                      </span>
                      <span className="num text-center text-[9.5px] text-muted">{s.seeded ? (left === null ? '-' : left === 0 ? 'FULL' : left) : 'n/s'}</span>
                    </span>
                  )
                })}
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <caption className="sr-only">Sold, sellable, physical, reserve and free seats for each session of {trackName(track)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Slot</th>
                      <th scope="col">Sold</th>
                      <th scope="col">Sellable</th>
                      <th scope="col">Physical</th>
                      <th scope="col">Reserve</th>
                      <th scope="col">Free</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.sessionId}>
                        <th scope="row" className="num font-normal text-ink">
                          {s.slotLabel}
                        </th>
                        <td className="num">{s.seeded ? s.sold : 'not seeded'}</td>
                        <td className="num">{s.sellable ?? '-'}</td>
                        <td className="num">{s.physical ?? '-'}</td>
                        <td className="num">{s.reserve ?? '-'}</td>
                        <td className="num">{s.free ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </section>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <section className="card flex flex-col" aria-labelledby="recon-h">
          <div className="card-head">
            <span id="recon-h" className="card-title">
              RECONCILIATION
            </span>
            <span className="lbl">hourly</span>
          </div>
          {d.reconcile ? (
            <>
              <div className="row">
                <span className="copy">Last run</span>
                <span className="num text-[12px] text-ink">{when(d.reconcile.ranAt)}</span>
              </div>
              <div className="row">
                <span className="copy">Abandoned on that run</span>
                <span className="stat-val stat-val-sm">{d.reconcile.abandoned ?? 0}</span>
              </div>
              <div className="row">
                <span className="copy">Mismatches</span>
                <span className="stat-val stat-val-sm" data-tone={d.reconcile.mismatches ? 'warn' : undefined}>
                  {d.reconcile.mismatches}
                </span>
              </div>
              <div className="row">
                <span className="copy">Emails sent</span>
                <span className="stat-val stat-val-sm">{d.reconcile.emailed ?? 0}</span>
              </div>
              {!d.reconcile.ok ? (
                <p role="alert" className="row-body text-err-ink">
                  The last run failed: {d.reconcile.error ?? 'no detail recorded'}
                </p>
              ) : null}
            </>
          ) : (
            <p className="row-body">Never run. Until it does, a lapsed hold is not swept and an owed email 2 is not retried.</p>
          )}
        </section>

        <section className="card flex flex-col" aria-labelledby="email-h">
          <div className="card-head">
            <span id="email-h" className="card-title">
              EMAIL
            </span>
            <span className="lbl">SES</span>
          </div>
          <div className="row">
            <span className="copy">Bounces</span>
            <span className="stat-val stat-val-sm" data-tone={d.email.bounces ? 'warn' : undefined}>
              {d.email.bounces}
            </span>
          </div>
          <div className="row">
            <span className="copy">Complaints</span>
            <span className="stat-val stat-val-sm" data-tone={d.email.complaints ? 'err' : undefined}>
              {d.email.complaints}
            </span>
          </div>
          <div className="row">
            <span className="copy">Not suppressed</span>
            <span className="stat-val stat-val-sm" data-tone={d.email.unsuppressed ? 'err' : undefined}>
              {d.email.unsuppressed}
            </span>
          </div>
          <div className="row">
            <span className="copy">Confirmations owed</span>
            <span className="stat-val stat-val-sm" data-tone={d.email.confirmationsOwed ? 'warn' : undefined}>
              {d.email.confirmationsOwed}
            </span>
          </div>
          {d.email.unsuppressed > 0 ? (
            <p role="alert" className="row-body text-err-ink">
              {d.email.unsuppressed} address(es) bounced or complained but could not be added to the suppression list. Add them by hand in the
              SES console.
            </p>
          ) : null}
          {d.email.recent.length > 0 ? (
            d.email.recent.map((e) => (
              <div key={`${e.address}-${e.occurredAt}-${e.type}`} className="row row-top">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="num truncate text-[12px] text-ink">{e.address}</span>
                  <span className="hint">
                    {e.type}, {e.subType}, {e.suppressed ? 'suppressed' : (e.note ?? 'NOT suppressed')}
                  </span>
                </span>
                <span className="num flex-none text-[11px] text-muted">{when(e.occurredAt)}</span>
              </div>
            ))
          ) : (
            <p className="row-body">No bounces or complaints recorded.</p>
          )}
        </section>
      </div>
    </div>
  )
}
