import { AttendeeTable, type AttendeeRow } from '@/components/admin/AttendeeTable'
import { Container } from '@/components/layout/Container'
import { requireAdmin } from '@/lib/auth/admin'
import { loadDashboard } from '@/lib/db/stats'

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

  const rows: AttendeeRow[] = d.attendees.map((a) => ({
    ticketRef: a.ticketRef,
    name: a.name,
    email: a.email,
    college: a.college,
    tier: a.tier,
    foodPreference: a.foodPreference,
    paymentStatus: a.paymentStatus,
    checkedIn: Boolean(a.checkedInAt),
    swagIssued: Boolean(a.swagIssuedAt),
  }))

  return (
    <Container className="flex flex-col gap-16 py-12">
      <div>
        <h1 className="display text-step-3">Dashboard</h1>
        <p className="mt-2 text-step--1 text-muted">Live from the table on every load, nothing cached.</p>
      </div>

      <section aria-labelledby="totals">
        <h2 id="totals" className="display text-step-2">
          Registrations
        </h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total records" value={d.total} />
          <Stat label="Paid and coming" value={d.paid} />
          <Stat label="Checked in" value={d.checkedIn} />
          <Stat label="Swag issued" value={d.swagIssued} />
        </dl>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {d.byTier.map((t) => (
            <Stat key={t.tier} label={`Tier, ${t.tier}`} value={t.count} />
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
          Counts paid attendees only, so refunds and cancellations are not catered for.
        </p>
      </section>

      <section aria-labelledby="halls">
        <h2 id="halls" className="display text-step-2">
          Seats left per hall
        </h2>
        <div className="scroll-x mt-6">
          <table className="data-table">
            <caption className="sr-only">Seats remaining in each hall, by slot</caption>
            <thead>
              <tr>
                <th scope="col">Hall</th>
                {d.halls[0]?.slots.map((s) => (
                  <th key={s.slotId} scope="col">
                    {s.slotLabel}
                  </th>
                ))}
                <th scope="col">Total left</th>
              </tr>
            </thead>
            <tbody>
              {d.halls.map((hall) => (
                <tr key={hall.hallId}>
                  <th scope="row">{hall.hallName}</th>
                  {hall.slots.map((s) => (
                    <td key={s.slotId} className="mono">
                      {s.left} of {s.capacity}
                    </td>
                  ))}
                  <td className="mono">{hall.left}</td>
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
          <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Last run" value={new Date(d.reconcile.ranAt).toUTCString()} />
            <Stat label="Mismatches" value={d.reconcile.mismatches} />
            <Stat label="Inserted" value={d.reconcile.inserted} />
            <Stat label="Deactivated" value={d.reconcile.deactivated} />
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

      <section aria-labelledby="attendees">
        <h2 id="attendees" className="display text-step-2">
          Attendees
        </h2>
        <div className="mt-6">
          <AttendeeTable rows={rows} />
        </div>
      </section>
    </Container>
  )
}
