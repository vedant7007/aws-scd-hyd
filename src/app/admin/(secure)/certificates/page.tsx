import Link from 'next/link'
import { certAction } from '../actions'
import { requireAdmin } from '@/lib/auth/admin'
import { listCerts, type CertState } from '@/lib/certificates'

/**
 * Certificates as they were claimed. Most are issued on the spot; HELD ones
 * (a survey ID another pass already used) wait here for a look at the
 * screenshot. Withdraw anything that looks fake: its page then says not valid.
 */
const TABS: { id: CertState; label: string }[] = [
  { id: 'HELD', label: 'To check' },
  { id: 'ISSUED', label: 'Issued' },
  { id: 'REVOKED', label: 'Withdrawn' },
]

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(iso))

export default async function CertificatesPage({ searchParams }: PageProps<'/admin/certificates'>) {
  await requireAdmin()
  const all = await listCerts()
  const raw = (await searchParams).tab
  const held = all.filter((c) => c.state === 'HELD').length
  const tab: CertState = TABS.some((t) => t.id === raw) ? (raw as CertState) : held ? 'HELD' : 'ISSUED'
  const items = all.filter((c) => c.state === tab)

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// CERTIFICATES'}</span>
        <h1 className="h1">CERTIFICATES</h1>
        <p className="lede">Claimed on /certificate with an AWS survey submission ID and a screenshot. Issued straight away unless the survey ID was already used by another pass. Times are Hyderabad time.</p>
      </div>

      <nav aria-label="State" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/certificates?tab=${t.id}`} className={t.id === tab ? 'btn btn-primary btn-sm' : 'btn btn-sm'} aria-current={t.id === tab ? 'page' : undefined}>
            {t.label} ({all.filter((c) => c.state === t.id).length})
          </Link>
        ))}
      </nav>

      {items.length ? (
        items.map((c) => (
          <section key={c.passId} className={c.state === 'HELD' ? 'card-gold flex flex-col gap-2 p-4' : 'card flex flex-col gap-2 p-4'} aria-label={c.certName}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="card-title">{c.certName}</span>
              <span className="num text-[12px] text-muted">{when(c.createdAt)}</span>
            </div>
            <p className="copy num text-[13px] [overflow-wrap:anywhere]">
              {c.passId} · {c.email} · {c.surveyId}
            </p>
            {c.note ? <p className="hint">{c.note}</p> : null}
            <div className="flex flex-wrap gap-2">
              <a href={`/admin/cert-shot/${c.passId}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                SCREENSHOT
              </a>
              {c.state === 'ISSUED' ? (
                <a href={`/certificate/${c.certId}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                  CERTIFICATE
                </a>
              ) : null}
              <form action={certAction}>
                <input type="hidden" name="passId" value={c.passId} />
                <input type="hidden" name="to" value={c.state === 'ISSUED' ? 'REVOKED' : 'ISSUED'} />
                <button type="submit" className={c.state === 'ISSUED' ? 'btn btn-sm btn-warn' : 'btn btn-sm btn-mint'}>
                  {c.state === 'ISSUED' ? 'WITHDRAW' : 'ISSUE + EMAIL'}
                </button>
              </form>
            </div>
          </section>
        ))
      ) : (
        <p className="row-body">Nothing here.</p>
      )}
    </div>
  )
}
