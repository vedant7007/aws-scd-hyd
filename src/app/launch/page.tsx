import type { Metadata } from 'next'
import { LaunchSequence } from '@/components/launch/LaunchSequence'

/**
 * The secret launch page. Not in the nav, not in the sitemap, and noindex.
 *
 * Deliberately NOT added to robots.txt: that file is public, so a Disallow
 * line there would be the one place the path is advertised. noindex plus no
 * inbound link keeps it out of search without publishing where it is.
 */
export const metadata: Metadata = {
  title: 'Launch control',
  robots: { index: false, follow: false },
}

export default function LaunchPage() {
  return <LaunchSequence />
}
