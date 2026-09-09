import { Container } from '@/components/layout/Container'
import { event, registrationOpen, venue } from '@/content/event'
import { Countdown } from './Countdown'
import { HeroBackground } from './HeroBackground'

/**
 * Full viewport. The plate is a composed object sitting to the right, the
 * headline breaks the container edge and overlaps it, and the countdown sits
 * on the same baseline row as the date and venue rather than under everything.
 */
export function Hero() {
  return (
    <section className="hero">
      <div className="hero-plate" aria-hidden="true">
        <HeroBackground />
      </div>

      <Container className="hero-body enter">
        <p className="hero-eyebrow eyebrow">{event.host}</p>

        <h1 className="hero-title display">
          AWS Student
          <br />
          Community Day
          <br />
          <span className="line-accent">{event.city}</span>
        </h1>

        <div className="hero-meta">
          <div>
            <p className="eyebrow">Date</p>
            <p className="text-step-1">{event.dateLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Venue</p>
            <p className="text-step-1">{venue.name}</p>
          </div>
          <Countdown target={event.startsAt} label="Doors open in" />
        </div>

        <div className="hero-cta flex flex-wrap items-center gap-m">
          {registrationOpen ? (
            <a className="cta" href="#passes">
              Get a pass
            </a>
          ) : (
            <>
              <p className="cta-quiet">Registration opens soon</p>
              <p className="text-step--1 text-muted">Passes and prices are announced closer to the date.</p>
            </>
          )}
        </div>
      </Container>
    </section>
  )
}
