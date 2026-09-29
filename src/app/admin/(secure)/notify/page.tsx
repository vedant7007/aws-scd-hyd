import { NotifyOpenForm } from '@/components/admin/Settings'
import { passes, tierLabel } from '@/content/passes'
import { requireAdmin } from '@/lib/auth/admin'
import { listSubscribers } from '@/lib/db/queries'

/**
 * The notify list, on the page. Everyone who left an address while
 * registrations were closed, newest first, with the passes they said they
 * were eyeing. Admin only, like the CSV it sits beside: these are real
 * addresses.
 */

const when = (iso: string | undefined) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(
        new Date(iso),
      )
    : '-'

export default async function NotifyListPage() {
  await requireAdmin()
  const subs = await listSubscribers()

  // How many named each pass. One person can name several, so these do not
  // add up to the list length.
  const interest = passes.map((p) => ({ name: p.name, count: subs.filter((s) => s.interestedPasses?.includes(p.id)).length }))
  const undecided = subs.filter((s) => !s.interestedPasses?.length).length

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="eye">{'// NOTIFY LIST'}</span>
          <h1 className="h1">WAITING TO REGISTER</h1>
          <p className="lede">Everyone who asked to be told when registrations open, newest first. Times are Hyderabad time.</p>
        </div>
        <a className="btn btn-primary btn-sm" href="/api/admin/notify-csv" download>
          EXPORT CSV
        </a>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))]">
        <div className="stat-card">
          <span className="lbl">On the list</span>
          <span className="stat-val num" data-tone="ok">
            {subs.length}
          </span>
        </div>
        {interest.map((i) => (
          <div key={i.name} className="stat-card">
            <span className="lbl">Eyeing {i.name}</span>
            <span className="stat-val num">{i.count}</span>
          </div>
        ))}
        <div className="stat-card">
          <span className="lbl">No pass picked</span>
          <span className="stat-val num">{undecided}</span>
        </div>
      </div>

      <section className="card flex flex-col gap-3 p-4" aria-labelledby="open-h">
        <h2 id="open-h" className="card-title">
          TELL THEM REGISTRATIONS ARE OPEN
        </h2>
        <p className="copy">One email to each address below, with the register link. Sent once per person: anyone already told is skipped, so pressing again only retries failures.</p>
        <NotifyOpenForm waiting={subs.filter((s) => !s.openMailSentAt).length} />
      </section>

      <section className="card flex flex-col" aria-labelledby="list-h">
        <div className="card-head">
          <span id="list-h" className="card-title">
            {subs.length} {subs.length === 1 ? 'ADDRESS' : 'ADDRESSES'}
          </span>
        </div>
        {subs.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">Notify list: email, when they signed up, and the passes they were interested in</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Email</th>
                  <th scope="col">Signed up</th>
                  <th scope="col">Eyeing</th>
                  <th scope="col">Told open</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s, i) => (
                  <tr key={s.email}>
                    <td className="num text-muted">{subs.length - i}</td>
                    <th scope="row" className="num font-normal text-ink [overflow-wrap:anywhere]">
                      {s.email}
                    </th>
                    <td className="num whitespace-nowrap">{when(s.createdAt)}</td>
                    <td>{s.interestedPasses?.length ? s.interestedPasses.map((t) => tierLabel(t)).join(', ') : <span className="text-muted">-</span>}</td>
                    <td className="num whitespace-nowrap">{s.openMailSentAt ? when(s.openMailSentAt) : <span className="text-muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="row-body">Nobody yet. Addresses left on the register page appear here straight away.</p>
        )}
      </section>
    </div>
  )
}
