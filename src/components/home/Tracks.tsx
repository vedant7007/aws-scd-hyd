import { Container } from '@/components/layout/Container'
import { tracks } from '@/content/tracks'
import { TracksStage } from './TracksStage'

/**
 * The second largest moment on the page.
 *
 * Where the browser supports scroll driven animation the stage is pinned and
 * the tracks advance through it as you scroll, which is handled entirely in
 * globals.css on the compositor. Where it does not, or where reduced motion is
 * set, this is a plain stacked list and nothing is lost. The count goes on the
 * element so the CSS can pin only the arrangements it is designed for.
 */
export function Tracks() {
  if (tracks.length === 0) {
    return (
      <Container className="section-tight">
        <h2 id="tracks-h" className="eyebrow">Tracks</h2>
        <div className="awaiting mt-6">
          <p className="awaiting-head">
            Tracks are being <em>confirmed</em>
          </p>
        </div>
      </Container>
    )
  }

  return (
    <section id="tracks" aria-labelledby="tracks-h">
      <TracksStage count={tracks.length}>
        <div className="tracks-pin section-tight">
        <Container>
          <h2 id="tracks-h" className="eyebrow">
            {tracks.length} tracks, running in parallel
          </h2>

          <div className="mt-8">
            {tracks.map((track, i) => (
              <article key={track.id} className="track-item">
                <p className="track-index">
                  {String(i + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}
                </p>
                <h3 className="track-name">{track.name}</h3>
                <p className="measure text-step-1 text-muted">{track.blurb}</p>
              </article>
            ))}
          </div>
          </Container>
        </div>
      </TracksStage>
    </section>
  )
}
