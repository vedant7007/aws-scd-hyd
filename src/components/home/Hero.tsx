import { Container } from '@/components/layout/Container'
import { event, registrationOpen, venue } from '@/content/event'
import { Countdown } from './Countdown'
import { HeroBackground } from './HeroBackground'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackground />

      <Container className="enter flex flex-col gap-10 py-24 sm:py-32">
        <p className="text-step--1 text-muted">
          {event.host}
        </p>

        <h1 className="display text-step-5">
          AWS Student
          <br />
          Community Day
          <br />
          {event.city}
        </h1>

        <dl className="flex flex-wrap gap-x-12 gap-y-4 text-step-1">
          <div>
            <dt className="text-step--1 text-muted">Date</dt>
            <dd>{event.dateLabel}</dd>
          </div>
          <div>
            <dt className="text-step--1 text-muted">Venue</dt>
            <dd>{venue.name}</dd>
          </div>
        </dl>

        <div>
          <Countdown target={event.startsAt} label="Doors open in" />
        </div>

        <div className="flex flex-wrap items-center gap-4">
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
