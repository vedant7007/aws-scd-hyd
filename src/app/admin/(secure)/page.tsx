import Link from 'next/link'
import { AdminConsole, type Row } from '@/components/admin/AdminConsole'
import { formatInr, tierLabel } from '@/content/passes'
import { programSession } from '@/content/program'
import { requireAdmin } from '@/lib/auth/admin'
import { loadDashboard } from '@/lib/db/stats'
import type { Tier } from '@/lib/db/types'
import { launchStatus } from '@/lib/tickets/launch'

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
 * The handoff's Admin Dashboard, on the v3 lifecycle. Admin only:
 * requireAdmin runs before a single read. The verification queue comes
 * first because a student waiting on it cannot wait; every other number
 * can. Built to be read on a phone, one column, nothing that scrolls
 * sideways except the one table that is genuinely a table.
 */
export default async function AdminDashboardPage() {
  // Guard first. Nothing below runs for a refused, signed out or volunteer caller.
  await requireAdmin()
  const [d, launch] = await Promise.all([loadDashboard(), launchStatus()])

  const rows: Row[] = d.attendees.map((a) => ({
    passId: a.passId,
    name: a.name,
    email: a.email,
    phone: a.phone,
    college: a.college,
    branch: a.branch,
    rollNumber: a.rollNumber,
    yearOfStudy: a.yearOfStudy,
    dateOfBirth: a.dateOfBirth,
    tier: a.tier,
    tierName: tierLabel(a.tier),
    technical: programSession(a.technicalSession)?.title ?? a.technicalSession,
    workshop: a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : null,
    state: a.state,
    amountLabel: formatInr(a.amountPaise),
    utr: a.utr ?? null,
    utrSubmittedAt: a.utrSubmittedAt ?? null,
    screenshot: Boolean(a.screenshotKey),
    rejectionReason: a.rejectionReason ?? null,
    createdAt: a.createdAt,
    preview: a.source === 'preview',
    checkedIn: Boolean(a.checkedInAt),
  }))

  const sized = d.sessions.filter((s) => s.sellable !== null).length

  const tiers: Tier[] = ['basic', 'premium', 'ultra', 'vip']

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
            Switches and seats
          </Link>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
          <Stat label="Registration switch" value={launch.registrationOpen ? 'OPEN' : 'CLOSED'} tone={launch.registrationOpen ? 'ok' : 'err'} />
          <Stat label="Checkout" value={launch.open ? 'ACCEPTING' : 'REFUSING'} tone={launch.open ? 'ok' : 'err'} note="UPI, verified by hand" />
          <Stat label="Launch blockers" value={launch.blockers.length} tone={launch.blockers.length ? 'warn' : 'ok'} />
          <Stat label="Sessions sized" value={`${sized} / ${d.sessions.length}`} tone={sized === d.sessions.length ? 'ok' : 'warn'} note="seat counts set in settings" />
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
          <p className="hint">Nothing stands between the switch and real students.</p>
        )}
      </section>

      {/* The queue. Every other number on this page can wait; a student waiting on a verification cannot. */}
      <section className="flex flex-col gap-3" aria-labelledby="queue-h">
        <h2 id="queue-h" className="h2">
          REGISTRATIONS
        </h2>
        <AdminConsole rows={rows} />
        <p className="hint">
          Walk the real flow without opening it to the public at{' '}
          <Link href="/register/preview" className="num">
            /register/preview
          </Link>
          . Records made there are marked PREVIEW and never counted.
        </p>
      </section>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
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

        <section className="card flex flex-col" aria-labelledby="lunch-h">
          <div className="card-head">
            <span id="lunch-h" className="card-title">
              LUNCH HEADCOUNT
            </span>
            {/* This number goes to the caterer, so it has to leave the screen. */}
            <a className="btn btn-primary btn-sm" href="/api/admin/attendees-csv" download>
              EXPORT CSV
            </a>
          </div>
          <div className="row">
            <span className="h3">VERIFIED, COMING</span>
            <span className="stat-val stat-val-sm" data-tone="ok">
              {d.paid}
            </span>
          </div>
          <p className="row-body">Lunch is on every pass, one kind for everyone. Counts verified attendees only, previews excluded. The CSV is the full roster with sessions. Send the final count the night before.</p>
        </section>

        <section className="card flex flex-col" aria-labelledby="notify-h">
          <div className="card-head">
            <span id="notify-h" className="card-title">
              NOTIFY LIST
            </span>
            {/* Everyone who asked to be told when registrations open. */}
            <span className="flex flex-wrap gap-2">
              <Link href="/admin/notify" className="btn btn-sm">
                VIEW LIST
              </Link>
              <a className="btn btn-primary btn-sm" href="/api/admin/notify-csv" download>
                EXPORT CSV
              </a>
            </span>
          </div>
          <p className="row-body">
            Addresses left on the closed registration page, newest first, with the passes each person said they were eyeing. Write to this list the day registrations open.
          </p>
          <div className="row">
            <span className="copy">How many who reached the page left an address</span>
            <Link href="/admin/traffic" className="btn btn-mono-sm">
              Traffic
            </Link>
          </div>
        </section>
      </div>

      <section className="card flex flex-col" aria-labelledby="seats-h">
        <div className="card-head">
          <span id="seats-h" className="card-title">
            SEATS PER SESSION
          </span>
          <Link href="/admin/settings" className="btn btn-mono-sm">
            Set seats
          </Link>
        </div>
        <p className="row-body">
          Held counts every seat taken, by verified, pending and still-paying records alike, because each holds a real seat until it is
          verified or its hold lapses. Coming counts the verified ones. A dash is a session nobody has sized yet: it sells nothing.
        </p>
        <div className="tbl-wrap">
          <table className="tbl">
            <caption className="sr-only">Held, sellable, free and verified seats for each technical session and workshop</caption>
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Held</th>
                <th scope="col">Sellable</th>
                <th scope="col">Free</th>
                <th scope="col">Coming</th>
              </tr>
            </thead>
            <tbody>
              {d.sessions.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="font-normal text-ink">
                    <span className="num block text-[10.5px] text-muted">{s.code}</span>
                    {s.title}
                  </th>
                  <td className="num">{s.sold}</td>
                  <td className="num">{s.sellable ?? '-'}</td>
                  <td className="num" data-tone={s.free === 0 ? 'err' : undefined}>
                    {s.free === null ? '-' : s.free === 0 ? 'FULL' : s.free}
                  </td>
                  <td className="num">{s.verified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <p className="row-body">Never run. Until it does, a lapsed hold keeps its seats and an owed ticket is not retried.</p>
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
            <span className="copy">Tickets owed</span>
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
