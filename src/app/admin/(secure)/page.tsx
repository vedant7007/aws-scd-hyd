import { AdminConsole, type Row, type SlotOption } from '@/components/admin/AdminConsole'
import { Container } from '@/components/layout/Container'
import { slots as fallbackSlots } from '@/content/event'
import { formatInr, tierLabel } from '@/content/passes'
import { roomById, sessionSpecs, trackName } from '@/content/sessions'
import { getAttendeeWithSeats, getConfig } from '@/lib/db/queries'
import { requireAdmin } from '@/lib/auth/admin'
import { loadDashboard } from '@/lib/db/stats'
import { launchStatus } from '@/lib/tickets/launch'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <dt className="text-step--1 text-muted">{label}</dt>
      <dd className="display text-step-3">{value}</dd>
    </div>
  )
}

export default async function AdminDashboardPage() {
  // Guard first. Nothing below runs for a refused or signed out caller.
  await requireAdmin()
  const d = await loadDashboard()
  const launch = await launchStatus()

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
    tierName: tierLabel(a.tier),
    trackName: trackName(a.homeTrack),
    state: a.state,
    amountLabel: formatInr(a.amountPaise),
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
  const slotOptions: SlotOption[] = slotList.map((slot) => ({
    slotId: slot.id,
    label: slot.label,
    sessions: specs
      .filter((sp) => sp.slotId === slot.id)
      .map((sp) => ({ sessionId: sp.sessionId, slotId: slot.id, label: `${trackName(sp.track)}${sp.title ? `, ${sp.title}` : ''}${roomById(sp.roomId) ? `, ${roomById(sp.roomId)!.name}` : ''}` })),
  }))

  return (
    <Container className="flex flex-col gap-16 py-12">
      <div>
        <h1 className="display text-step-3">Dashboard</h1>
        <p className="mt-2 text-step--1 text-muted">Live from the table on every load, nothing cached.</p>
      </div>

      {/* First: the queue. Every other number on this page can wait; a student waiting on a verification cannot. */}
      <section aria-labelledby="queue">
        <h2 id="queue" className="display text-step-2">
          Registrations
        </h2>
        <div className="mt-6">
          <AdminConsole rows={rows} slots={slotOptions} sessionsReleased={d.sessionsReleased} />
        </div>
      </section>

      <section aria-labelledby="tracks">
        <h2 id="tracks" className="display text-step-2">
          Track counters
        </h2>
        <p className="mt-2 text-step--1 text-muted">
          Registrations counted against each track at step one, against the sellable seats of its room. A track at its
          ceiling refuses new registrations before the payment screen. Abandoned registrations give their place back.
        </p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          {d.trackLoad.map((t) => (
            <Stat key={t.track} label={t.trackName} value={t.seeded ? `${t.registered} of ${t.ceiling ?? 'no ceiling'}` : 'not seeded'} />
          ))}
        </dl>
      </section>

      {/*
        First, because it is the one thing that must be right before anything
        else on this page matters: can the site take real money, and if not, why.
      */}
      <section aria-labelledby="launch">
        <h2 id="launch" className="display text-step-2">
          Selling
        </h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          <Stat label="registrationOpen (content)" value={launch.registrationOpen ? 'true' : 'false'} />
          <Stat label="Checkout" value={launch.open ? 'accepting' : 'refusing'} />
          <Stat label="Launch blockers" value={launch.blockers.length} />
        </dl>
        {launch.blockers.length ? (
          <div className="notice mt-6" role="status">
            <p className="font-semibold">
              {launch.enforced
                ? 'Selling is blocked. registrationOpen alone cannot open it while any of these hold.'
                : 'Development: these would block selling in production.'}
            </p>
            <ul className="text-step--1">
              {launch.blockers.map((b) => (
                <li key={b.code}>{b.detail}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-step--1 text-muted">
            Nothing stands between registrationOpen and real students in {launch.mode} mode.
          </p>
        )}
      </section>

      <section aria-labelledby="totals">
        <h2 id="totals" className="display text-step-2">
          Registrations
        </h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total records" value={d.total} />
          <Stat label="Verified and coming" value={d.paid} />
          <Stat label="Awaiting verification" value={d.awaitingVerification} />
          <Stat label="Checked in" value={d.checkedIn} />
          <Stat label="Swag issued" value={d.swagIssued} />
        </dl>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {d.byTier.map((t) => (
            <Stat key={t.tier} label={`Tier, ${tierLabel(t.tier)}`} value={t.count} />
          ))}
        </dl>
      </section>

      <section aria-labelledby="food">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="food" className="display text-step-2">
            Food
          </h2>
          {/* This number goes to the caterer, so it has to leave the screen. */}
          <a className="cta-quiet" href="/api/admin/food-csv" download>
            Download CSV
          </a>
        </div>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          {d.byFood.map((f) => (
            <Stat key={f.food} label={f.food} value={f.count} />
          ))}
        </dl>
        <p className="mt-4 text-step--1 text-muted">
          Counts verified attendees only, so rejections and abandoned registrations are not catered for.
        </p>
      </section>

      <section aria-labelledby="sessions">
        <h2 id="sessions" className="display text-step-2">
          Seats per session
        </h2>
        <p className="mt-2 text-step--1 text-muted">
          Sold counts every seat held, by paid and pending records alike, because a pending record holds a real seat
          until it is verified or its hold lapses. Sellable is what registration may claim, physical is the room,
          reserve is the difference. A dash is a value not yet decided.
        </p>
        <div className="scroll-x mt-6">
          <table className="data-table">
            <caption className="sr-only">Sold, sellable, physical and reserve seats for each session</caption>
            <thead>
              <tr>
                <th scope="col">Slot</th>
                <th scope="col">Track</th>
                <th scope="col">Room</th>
                <th scope="col">Sold</th>
                <th scope="col">Sellable</th>
                <th scope="col">Physical</th>
                <th scope="col">Reserve</th>
                <th scope="col">Free</th>
              </tr>
            </thead>
            <tbody>
              {d.sessions.map((s) => (
                <tr key={s.sessionId}>
                  <th scope="row">{s.slotLabel}</th>
                  <td>{s.trackName}</td>
                  <td>{s.roomName ?? 'Unassigned'}</td>
                  <td className="mono">{s.seeded ? s.sold : 'not seeded'}</td>
                  <td className="mono">{s.sellable ?? '–'}</td>
                  <td className="mono">{s.physical ?? '–'}</td>
                  <td className="mono">{s.reserve ?? '–'}</td>
                  <td className="mono">{s.free ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="reconcile">
        <h2 id="reconcile" className="display text-step-2">
          Reconciliation
        </h2>
        {d.reconcile ? (
          <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Last run" value={new Date(d.reconcile.ranAt).toUTCString()} />
            <Stat label="Mismatches" value={d.reconcile.mismatches} />
            <Stat label="Inserted" value={d.reconcile.inserted} />
            <Stat label="Deactivated" value={d.reconcile.deactivated} />
            <Stat label="Emails sent" value={d.reconcile.emailed ?? 0} />
          </dl>
        ) : (
          <p className="mt-4 text-muted">
            Never run. Until it does, a webhook that failed silently would leave a student holding a valid
            ticket we have no record of.
          </p>
        )}
        {d.reconcile && !d.reconcile.ok ? (
          <p role="alert" className="mt-4 text-accent">
            The last run failed: {d.reconcile.error ?? 'no detail recorded'}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="email">
        <h2 id="email" className="display text-step-2">
          Email
        </h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Bounces" value={d.email.bounces} />
          <Stat label="Complaints" value={d.email.complaints} />
          <Stat label="Not suppressed" value={d.email.unsuppressed} />
          <Stat label="Confirmations owed" value={d.email.confirmationsOwed} />
        </dl>
        {d.email.unsuppressed > 0 ? (
          <p role="alert" className="mt-4 text-accent">
            {d.email.unsuppressed} address(es) bounced or complained but could not be added to the suppression list.
            Add them by hand in the SES console.
          </p>
        ) : null}
        {d.email.recent.length > 0 ? (
          <div className="scroll-x mt-6">
            <table className="data-table">
              <caption className="sr-only">Recent bounces and complaints</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Type</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Address</th>
                  <th scope="col">Suppressed</th>
                </tr>
              </thead>
              <tbody>
                {d.email.recent.map((e) => (
                  <tr key={`${e.address}-${e.occurredAt}-${e.type}`}>
                    <td className="mono">{new Date(e.occurredAt).toUTCString()}</td>
                    <td>{e.type}</td>
                    <td>{e.subType}</td>
                    <td className="mono">{e.address}</td>
                    <td>{e.suppressed ? 'yes' : e.note ? e.note : 'NO'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-step--1 text-muted">No bounces or complaints recorded.</p>
        )}
      </section>

    </Container>
  )
}
