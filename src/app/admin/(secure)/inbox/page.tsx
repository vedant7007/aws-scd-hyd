import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/admin'
import { FORM_KINDS, fieldLabel, listForms, type FormKind } from '@/lib/forms'

/**
 * Speaker interest forms and code of conduct reports, as
 * they arrived, newest first. Each was also mailed to the organisers with
 * Reply-To set to the sender; this page is the record when a mail goes
 * astray. Admin only: reports can name people.
 */

const TABS: Record<FormKind, string> = { speak: 'Speakers', report: 'Reports' }

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date(iso))

export default async function InboxPage({ searchParams }: PageProps<'/admin/inbox'>) {
  await requireAdmin()
  const raw = (await searchParams).tab
  const tab: FormKind = FORM_KINDS.includes(raw as FormKind) ? (raw as FormKind) : 'report'
  const lists = await Promise.all(FORM_KINDS.map(listForms))
  const items = lists[FORM_KINDS.indexOf(tab)]!
  const counts = Object.fromEntries(FORM_KINDS.map((k, i) => [k, lists[i]!.length])) as Record<FormKind, number>
  const urgent = lists[FORM_KINDS.indexOf('report')]!.filter((r) => r.urgent).length

  return (
    <div className="page page-1180 rise">
      <div className="flex flex-col gap-2">
        <span className="eye">{'// INBOX'}</span>
        <h1 className="h1">FORMS</h1>
        <p className="lede">Everything sent from the Speak and code of conduct pages, newest first. Each also went to the organisers&apos; mail; reply there. Times are Hyderabad time.</p>
      </div>

      <nav aria-label="Form" className="flex flex-wrap gap-2">
        {FORM_KINDS.map((k) => (
          <Link key={k} href={`/admin/inbox?tab=${k}`} className={k === tab ? 'btn btn-primary btn-sm' : 'btn btn-sm'} aria-current={k === tab ? 'page' : undefined}>
            {TABS[k]} ({counts[k]})
          </Link>
        ))}
        {urgent ? <span className="pill pill-err self-center">{urgent} urgent</span> : null}
      </nav>

      {items.length ? (
        items.map((s) => (
          <section key={s.SK} className={s.urgent ? 'card-err flex flex-col gap-2 p-4' : 'card flex flex-col gap-2 p-4'} aria-label={s.ref}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="num text-[15px] font-semibold text-ink">{s.ref}</span>
              <span className="num text-[12px] text-muted">{when(s.createdAt)}</span>
            </div>
            <a href={`mailto:${s.email}?subject=${encodeURIComponent(`Re: ${s.ref}`)}`} className="num text-[13px] [overflow-wrap:anywhere]">
              {s.email}
            </a>
            <dl className="grid gap-x-4 gap-y-1.5 [grid-template-columns:max-content_1fr]">
              {Object.entries(s.fields)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="lbl-sm pt-0.5">{fieldLabel(k)}</dt>
                    <dd className="copy whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
        ))
      ) : (
        <p className="row-body">Nothing yet. Submissions appear here the moment they are sent.</p>
      )}
    </div>
  )
}
