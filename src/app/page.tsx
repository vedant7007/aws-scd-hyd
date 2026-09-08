import { Hero } from '@/components/home/Hero'
import { Ticker } from '@/components/home/Ticker'

export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      {/* Tracks, about, speakers, passes, sponsors, venue and FAQ follow here,
          in the order set out in SPEC.md section 11. */}
    </>
  )
}
