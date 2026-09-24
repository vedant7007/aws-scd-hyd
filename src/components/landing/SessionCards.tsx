import type { CSSProperties } from 'react'
import { formats } from '@/content/formats'

/**
 * The five session formats, as the cards in the pinned horizontal stage.
 *
 * Each card is two columns, text left and a solid accent illustration panel
 * right, stacking under 620px. Every illustration is CSS blocks only: no
 * images, no canvas, nothing to load. The loops are declared in globals.css
 * under the sf- prefix and all of them are transform or opacity only, so a
 * frozen animation can never leave a panel blank, and every one of them is
 * switched off by the reduced-motion rule that already covers the page.
 *
 * This file sits under components/landing, so it keeps the handoff's inline
 * literals like the rest of the ported design; check:tokens exempts it.
 */
export function SessionCards() {
  return (
    <>
      {formats.map((f) => (
        <article
          key={f.id}
          data-card="1"
          data-fmt={f.id}
          style={
            {
              '--sf': f.accent,
              flex: 'none',
              width: 'min(86vw,860px)',
              border: '4px solid var(--sf)',
              background: 'var(--surface)',
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr)',
              minHeight: 'clamp(320px,54vh,450px)',
              boxShadow: '8px 8px 0 var(--sh)',
              overflow: 'hidden',
            } as CSSProperties
          }
          className="sf-card"
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(11px,2vh,20px)',
              padding: 'clamp(20px,3.2vw,44px)',
              minWidth: '0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              {/* Decorative: the heading below names the session and the stage
                  counter says which of the five it is. */}
              <span
                data-sf-no="1"
                aria-hidden="true"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(40px,8vw,76px)', lineHeight: '.85', color: 'var(--sf)' }}
              >
                {f.no}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                <span data-sf-dot="1" style={{ width: '8px', height: '8px', background: 'var(--sf)', display: 'block' }} />
                {f.live}
              </span>
            </div>

            <h3
              style={{
                margin: '0',
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                fontSize: 'clamp(26px,6vw,52px)',
                lineHeight: '.96',
                color: 'var(--ink)',
              }}
            >
              {f.name}
            </h3>

            <p style={{ margin: '0', maxWidth: '40ch', fontSize: 'clamp(14px,3.6vw,17px)', lineHeight: '1.6', color: 'var(--body)' }}>{f.blurb}</p>

            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              {f.tags.map((t) => (
                <span key={t} style={{ border: '2px solid var(--line-soft)', padding: '7px 10px' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="sf-art" aria-hidden="true">
            <span className="sf-grid" />
            <span className="sf-sweep" />
            <Art id={f.id} />
          </div>
        </article>
      ))}
    </>
  )
}

/** One illustration per format. Blocks only, so nothing here can fail to load. */
function Art({ id }: { id: string }) {
  if (id === 'keynote') {
    return (
      <span className="sf-scene sf-keynote">
        <span className="sf-tag">MAIN STAGE</span>
        <span className="sf-cone" />
        <span className="sf-flash" />
        <span className="sf-podium">
          <span className="sf-logo" />
        </span>
        <span className="sf-mic">
          <span className="sf-mic-head" />
        </span>
        <span className="sf-crowd">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="sf-head" style={{ animationDelay: `${(i % 7) * 0.18}s` }} />
          ))}
        </span>
      </span>
    )
  }

  if (id === 'technical') {
    return (
      <span className="sf-scene sf-technical">
        <span className="sf-term">
          <span className="sf-bar">
            <span className="sf-dot sf-d1" />
            <span className="sf-dot sf-d2" />
            <span className="sf-dot sf-d3" />
            <span className="sf-tabs">
              <span className="sf-tab sf-tab-a">CLOUD ENG</span>
              <span className="sf-tab sf-tab-b">AI</span>
            </span>
          </span>
          <span className="sf-lines">
            <span className="sf-line sf-l1">$ aws cloudformation deploy</span>
            <span className="sf-line sf-l2">{'✓ stack ready'}</span>
            <span className="sf-line sf-l3">$ python agent.py --ask</span>
            <span className="sf-line sf-l4">{'> thinking…'}</span>
            <span className="sf-caret" />
          </span>
        </span>
      </span>
    )
  }

  if (id === 'workshop') {
    return (
      <span className="sf-scene sf-workshop">
        <span className="sf-tag">BUILD ALONG</span>
        <span className="sf-float sf-f1">+1</span>
        <span className="sf-float sf-f2">{'</>'}</span>
        <span className="sf-float sf-f3">{'✓'}</span>
        <span className="sf-laptop">
          <span className="sf-screen">
            <span className="sf-deploy">DEPLOYING{'…'}</span>
            <span className="sf-prog">
              <span className="sf-prog-fill" />
            </span>
            <span className="sf-steps">
              <span className="sf-step">STEP 1 {'✓'}</span>
              <span className="sf-step">STEP 2 {'✓'}</span>
              <span className="sf-step sf-step-live">STEP 3 _</span>
            </span>
          </span>
          <span className="sf-base" />
        </span>
      </span>
    )
  }

  if (id === 'panel') {
    return (
      <span className="sf-scene sf-panel">
        <span className="sf-tag sf-tag-live">
          <span className="sf-rec" />
          LIVE PANEL
        </span>
        <span className="sf-speakers">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="sf-sp" style={{ animationDelay: `${i * 1.6}s` }}>
              <span className="sf-sp-head" />
              <span className="sf-sp-body" />
              <span className="sf-eq">
                <span style={{ animationDelay: `${i * 0.1}s` }} />
                <span style={{ animationDelay: `${i * 0.1 + 0.12}s` }} />
                <span style={{ animationDelay: `${i * 0.1 + 0.24}s` }} />
              </span>
            </span>
          ))}
        </span>
        <span className="sf-table">
          <span className="sf-plate" />
          <span className="sf-plate" />
          <span className="sf-plate" />
          <span className="sf-plate" />
        </span>
      </span>
    )
  }

  return (
    <span className="sf-scene sf-qa">
      <span className="sf-tag">MIC OPEN</span>
      <span className="sf-bub sf-b1">? HOW DO I START</span>
      <span className="sf-bub sf-b2">BUILD ONE THING !</span>
      <span className="sf-bub sf-b3">? IS AI TAKING MY JOB</span>
      <span className="sf-q sf-q1">?</span>
      <span className="sf-q sf-q2">?</span>
    </span>
  )
}
