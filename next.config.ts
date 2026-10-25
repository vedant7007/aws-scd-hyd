import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /** 90 is for the prize photos, which are product shots and show compression at 75. */
  images: { qualities: [75, 90] },
  /**
   * /schedule, /speakers and /sponsors were separate pages before the v3
   * handoff, which folds all three into the home page. Old links, shared
   * posts and search results land on the matching section instead of a 404.
   */
  async redirects() {
    return [
      { source: '/schedule', destination: '/#prog', permanent: true },
      { source: '/speakers', destination: '/#speakers', permanent: true },
      { source: '/sponsors', destination: '/#sponsors', permanent: true },
    ]
  },
}

export default nextConfig
