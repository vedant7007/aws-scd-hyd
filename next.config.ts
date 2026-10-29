import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /** 90 is for the prize photos, which are product shots and show compression at 75. */
  images: { qualities: [75, 90] },
  /**
   * /schedule, /speakers and /sponsors were separate pages before the v3
   * handoff, which folds all three into the home page. Old links, shared
   * posts and search results land on the matching section instead of a 404.
   * The day's schedule came back as /agenda (30 October 2026): a new path,
   * because browsers cache the old permanent /schedule redirect. /schedule
   * now points there, temporarily, so it can change again.
   */
  async redirects() {
    return [
      { source: '/schedule', destination: '/agenda', permanent: false },
      { source: '/speakers', destination: '/#speakers', permanent: true },
      { source: '/sponsors', destination: '/#sponsors', permanent: true },
    ]
  },
}

export default nextConfig
