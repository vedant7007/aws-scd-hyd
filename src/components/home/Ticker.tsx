import { event, venue } from '@/content/event'

const ITEMS = [
  event.name,
  event.dateLabel,
  venue.name,
  'AI and agents',
  'Cloud engineering',
  'Careers',
]

function Half() {
  return (
    <ul className="flex shrink-0 items-center">
      {ITEMS.map((item) => (
        <li key={item} className="flex items-center gap-8 px-8 py-3 text-step--1 font-medium whitespace-nowrap">
          <span>{item}</span>
          <span>/</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Decorative. Everything it says is stated properly in the hero, so it is
 * hidden from assistive tech rather than read out twice.
 */
export function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        <Half />
        <Half />
      </div>
    </div>
  )
}
