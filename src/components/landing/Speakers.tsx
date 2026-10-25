import Image from 'next/image'
import { technicalSessions, workshops } from '@/content/program'
import { speakers, type Speaker } from '@/content/speakers'

/**
 * The line-up on the home page, in three tiers, in the site's pixel language:
 * notched pixel frames, flat colour, hard shadows, quiet motion. The chief
 * guest in gold, the panel in violet behind name plates, then technical talks
 * and hands-on workshops; any session without an announced speaker shows as
 * locked until it is revealed.
 */

function Chief({ s }: { s: Speaker }) {
  return (
    <article className="cg" aria-label={`Guest speaker: ${s.name}`}>
      <span className="cg-corner cg-tl" aria-hidden="true" />
      <span className="cg-corner cg-tr" aria-hidden="true" />
      <span className="cg-corner cg-bl" aria-hidden="true" />
      <span className="cg-corner cg-br" aria-hidden="true" />
      <div className="cg-pic">
        <span className="cg-frame">{s.photo ? <Image src={s.photo} alt={s.name} fill sizes="(max-width: 720px) 70vw, 340px" style={{ objectFit: 'cover' }} priority={false} /> : null}</span>
      </div>
      <div className="cg-copy">
        <span className="cg-ribbon">★ GUEST SPEAKER ★</span>
        <h3 className="cg-name">{s.name}</h3>
        <span className="cg-title">{s.designation}</span>
        <span className="cg-org">{s.org}</span>
        <p className="cg-line">{s.line}</p>
      </div>
    </article>
  )
}

function Seat({ s }: { s: Speaker }) {
  return (
    <article className="pd-seat" aria-label={`Panelist: ${s.name}`}>
      <div className="pd-pic">
        {s.photo ? <Image src={s.photo} alt={s.name} fill sizes="(max-width: 720px) 80vw, 320px" style={{ objectFit: 'cover' }} /> : null}
      </div>
      <div className="pd-tent">
        <span className="pd-tent-name">{s.name}</span>
        <span className="pd-tent-org">{s.org}</span>
      </div>
      <span className="pd-title">{s.designation}</span>
      <p className="pd-line">{s.line}</p>
      <span className="pd-tags">
        {s.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </span>
    </article>
  )
}

/** A pixel cloud, the home page's own shape, in rows of blocks. */
function PixelCloud({ className }: { className: string }) {
  return (
    <span className={className}>
      <i style={{ left: '23%', top: 0, width: '40%' }} />
      <i style={{ left: '9%', top: '25%', width: '74%' }} />
      <i style={{ left: 0, top: '50%', width: '100%' }} />
      <i style={{ left: '6%', top: '75%', width: '86%' }} />
    </span>
  )
}

/**
 * The Tetris floor along the bottom of the section: columns of blocks, bottom
 * up, by colour (o orange, m mint, v violet, p pink, g gold). Fixed, so it is
 * the same on every load; it is a backdrop, not a game.
 */
const STACK: string[][] = [
  ['o', 'o'], ['o', 'm', 'm'], ['m', 'm'], ['v'], ['v', 'v', 'p'], ['p', 'p'], ['g'], ['g', 'o', 'o'], ['o', 'm'], ['m', 'm', 'm'],
  ['v', 'v'], ['p'], ['p', 'g', 'g'], ['g', 'g'], ['o'], ['o', 'o', 'v'], ['m', 'v'], ['m'], ['p', 'p', 'p'], ['g', 'o'],
  ['o', 'o'], ['v', 'm', 'm'], ['v'], ['p', 'p'], ['g', 'g', 'm'], ['m'], ['o', 'v'], ['o', 'o', 'o'], ['p'], ['g', 'g'],
]

export function Speakers() {
  const chief = speakers.filter((s) => s.role === 'chief')
  const panel = speakers.filter((s) => s.role === 'panel')
  const named = speakers.filter((s) => s.session)
  const slots = [...technicalSessions, ...workshops]

  return (
    <section id="speakers" className="spk" aria-labelledby="spk-h">
      <div className="spk-sky" aria-hidden="true">
        <PixelCloud className="spk-cloud spk-cloud-1" />
        <PixelCloud className="spk-cloud spk-cloud-2" />
        <PixelCloud className="spk-cloud spk-cloud-3" />
      </div>
      <div className="spk-stack" aria-hidden="true">
        {STACK.map((col, x) => (
          <span key={x} className="spk-col">
            {col.map((c, y) => (
              <i key={y} data-c={c} />
            ))}
          </span>
        ))}
      </div>
      <div className="spk-wrap">
        <div className="spk-head">
          <div className="flex flex-col gap-2.5">
            <span className="spk-eye">{'// THE LINE-UP'}</span>
            <h2 id="spk-h" className="spk-h">
              MEET THE SPEAKERS
            </h2>
          </div>
          <span className="spk-count">{speakers.length} ANNOUNCED · MORE SOON</span>
        </div>

        {chief.map((s) => (
          <Chief key={s.name} s={s} />
        ))}

        {panel.length ? (
          <div className="pd">
            <div className="pd-banner">
              <span>PANEL DISCUSSION</span>
              <small>Cloud, AI &amp; beyond</small>
            </div>
            <div className="pd-seats">
              {panel.map((s) => (
                <Seat key={s.name} s={s} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="tl">
          <div className="tl-head">
            <span className="tl-h">TECH TALKS &amp; HANDS-ON</span>
            <span className="tl-sub">Speakers revealing soon. Follow @awssbg_vjit for every drop.</span>
          </div>
          <div className="tl-grid">
            {slots.map((x) => {
              const who = named.find((s) => s.session === x.id)
              return (
                <article key={x.id} className="tl-card" data-kind={x.kind} data-locked={who ? undefined : '1'}>
                  <span className="tl-code">{x.code}</span>
                  <span className="tl-title">{x.title}</span>
                  <span className="tl-who">
                    <span className="tl-avatar" aria-hidden="true">
                      {who?.photo ? <Image src={who.photo} alt="" fill sizes="44px" style={{ objectFit: 'cover' }} /> : '?'}
                    </span>
                    {who ? (
                      <span>
                        <b>{who.name}</b>
                        <small>{who.org}</small>
                      </span>
                    ) : (
                      <span>
                        <b>Revealing soon</b>
                        <small>{x.kind === 'workshop' ? 'Hands-on workshop' : 'Tech talk'}</small>
                      </span>
                    )}
                  </span>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
