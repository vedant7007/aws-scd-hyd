import type { Tier } from '../lib/db/types'

/**
 * The five session formats the day is built from. This replaces the old
 * three-track model on every public surface: there are no tracks, no halls
 * per track and no per-slot selection any more. What a pass gets is decided
 * by its tier, listed here and in content/passes.ts and nowhere else.
 *
 * `minTier` is the lowest tier that may attend. Order matters: it is the
 * order of the tier list in passes.ts.
 */
export type SessionFormat = {
  id: 'keynote' | 'technical' | 'workshop' | 'panel' | 'qa'
  /** Two digits, as the cards and the counter print it. */
  no: string
  name: string
  blurb: string
  /** The bordered chips under the blurb. */
  tags: [string, string]
  /** The corner tag on the illustration panel. */
  live: string
  /** Lowest tier that gets it. null means every pass. */
  minTier: Tier | null
  /** The accent this format carries everywhere it appears, as a token reference. */
  accent: string
}

export const formats: SessionFormat[] = [
  {
    id: 'keynote',
    no: '01',
    name: 'KEYNOTE',
    blurb: 'Opening talk, everyone in one room, big picture on cloud and AI.',
    tags: ['Every pass', 'One room'],
    live: 'LIVE',
    minTier: null,
    accent: 'var(--fmt-keynote)',
  },
  {
    id: 'technical',
    no: '02',
    name: 'TECHNICAL SESSIONS',
    blurb: 'Two topics: Cloud Engineering and AI. Practical talks with questions at the end. You sit in on one.',
    tags: ['Every pass', 'Cloud Eng or AI'],
    live: 'RUNNING',
    minTier: null,
    accent: 'var(--fmt-technical)',
  },
  {
    id: 'workshop',
    no: '03',
    name: 'HANDS-ON WORKSHOPS',
    blurb: 'Laptop open, build along with the speaker.',
    tags: ['Premium and above', 'Bring a laptop'],
    live: 'BUILDING',
    minTier: 'premium',
    accent: 'var(--fmt-workshop)',
  },
  {
    id: 'panel',
    no: '04',
    name: 'PANEL DISCUSSION',
    blurb: 'Engineers and builders on one stage answering student questions.',
    tags: ['Platinum and above', 'Open Q and A'],
    live: 'LIVE PANEL',
    minTier: 'ultra',
    accent: 'var(--fmt-panel)',
  },
  {
    id: 'qa',
    no: '05',
    name: 'Q AND A SESSION',
    blurb: 'Open mic with the speakers: careers, code, cloud, AI.',
    tags: ['Premium and above', 'Open mic'],
    live: 'MIC OPEN',
    minTier: 'premium',
    accent: 'var(--fmt-qa)',
  },
]

/** What the counter and the marquee print. */
export const formatCount = formats.length
