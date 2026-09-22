import type { Metadata } from 'next'
import { Container } from '@/components/layout/Container'
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
    <Container className="section-tight flex flex-col gap-8">
      <div>
        <p className="eyebrow">Your pass</p>
        <h1 className="display text-step-3 mt-2">Type your pass ID</h1>
        <p className="measure mt-4 text-muted">
          It is in your confirmation email and looks like SCD-K4M7PQR29T. Capitals, spaces and the hyphen do not matter.
        </p>
      </div>
      <form method="post" action="/pass/lookup" className="reg-form" noValidate>
        <div className="reg-field">
          <label htmlFor="passId">Pass ID</label>
          <input
            id="passId"
            name="passId"
            className="field numeral"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={20}
            aria-describedby={notfound ? 'passId-err' : undefined}
            aria-invalid={notfound ? true : undefined}
          />
          {notfound ? (
            <p id="passId-err" role="alert" className="reg-error">
              {NOT_FOUND_COPY}
            </p>
          ) : null}
        </div>
        <div className="reg-actions">
          <button type="submit" className="cta">
            Open my pass
          </button>
        </div>
      </form>
    </Container>
  )
}
