import type { Track } from '@/lib/db/types'

export type TrackContent = {
  id: Track
  name: string
  blurb: string
}

/** TODO(vedant): blurbs are drafts, replace with the copy from the team. */
export const tracks: TrackContent[] = [
  {
    id: 'ai',
    name: 'AI and agents',
    blurb: 'Building with models and agents, what actually works in production, and what does not.',
  },
  {
    id: 'cloud',
    name: 'Cloud engineering',
    blurb: 'Architecture, cost, reliability and the day to day of running things on AWS.',
  },
  {
    id: 'career',
    name: 'Careers',
    blurb: 'Internships, first roles, certifications and building something worth showing people.',
  },
]
