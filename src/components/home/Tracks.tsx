import { Section } from '@/components/layout/Section'
import { tracks } from '@/content/tracks'

export function Tracks() {
  return (
    <Section id="tracks" title="Three tracks">
      <ul>
        {tracks.map((track) => (
          <li key={track.id} className="border-t border-border py-10 first:border-t-0 first:pt-0">
            <h3 className="display text-step-4">{track.name}</h3>
            <p className="measure mt-4 text-step-1 text-muted">{track.blurb}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
