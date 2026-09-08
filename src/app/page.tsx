import { About } from '@/components/home/About'
import { Faq } from '@/components/home/Faq'
import { Hero } from '@/components/home/Hero'
import { Passes } from '@/components/home/Passes'
import { Speakers } from '@/components/home/Speakers'
import { Sponsors } from '@/components/home/Sponsors'
import { Ticker } from '@/components/home/Ticker'
import { Tracks } from '@/components/home/Tracks'
import { Venue } from '@/components/home/Venue'

/** Order is fixed by SPEC.md section 11. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Ticker />
      <About />
      <Tracks />
      <Speakers />
      <Passes />
      <Sponsors />
      <Venue />
      <Faq />
    </>
  )
}
