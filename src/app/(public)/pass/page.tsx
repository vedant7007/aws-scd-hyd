import type { Metadata } from 'next'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: `Find your pass, ${event.shortName}`,
  robots: { index: false, follow: true },
}

/** The one wording for every miss. Amendment 2 section 2. */
const NOT_FOUND_COPY = 'We could not find that pass ID, check it and try again.'

/**
 * Where a student types their pass id. The link in email 2 skips this and
 * opens the pass directly; this is for the ones who only have the id.
 */
export default async function PassEntryPage({ searchParams }: PageProps<'/pass'>) {
  const { notfound } = await searchParams
  return (
    <div className="page rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// YOUR PASS'}</span>
        <h1 className="h1">TYPE YOUR PASS ID</h1>
        <p className="lede">
          It is in your confirmation email and looks like <span className="num text-ink">SCD-K4M7PQR29T</span>. Capitals, spaces and the
          hyphen do not matter.
        </p>
      </div>
      <form method="post" action="/pass/lookup" className="card flex flex-col gap-4 p-4" noValidate>
        <div className="fld">
          <label htmlFor="passId">Pass ID</label>
          <input
            id="passId"
            name="passId"
            className="inp inp-num"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={20}
            placeholder="SCD-"
            aria-describedby={notfound ? 'passId-err' : undefined}
            aria-invalid={notfound ? true : undefined}
          />
          {notfound ? (
            <p id="passId-err" role="alert" className="err-text">
              {NOT_FOUND_COPY}
            </p>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary btn-lg">
          OPEN MY PASS &gt;
        </button>
      </form>
    </div>
  )
}
