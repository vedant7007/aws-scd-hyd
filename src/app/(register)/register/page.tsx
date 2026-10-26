import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Flow } from '@/components/register/Flow'
import { LockedHero } from '@/components/register/LockedHero'
import { REGISTRATION_OPEN, doorsLabel, event } from '@/content/event'
import { registrationIsOpen } from '@/lib/tickets/launch'

export const metadata: Metadata = {
  title: 'Register',
  description: `Register for ${event.name} on ${event.dateLabel}. Pick a pass from Rs 499, choose your cloud or AI session and hands-on workshop, and pay by UPI. Lunch on every pass.`,
}

/**
 * The closed registration screen, ported from the v3 handoff's
 * Register.dc.html. Since 27 October 2026 it says registration has closed
 * for good (it said "opening soon" before launch): the padlock, a thank you,
 * when tickets go out, and nothing to sign up for.
 *
 * Departures from the handoff: the background is the site's drifting grid
 * without the hover-lit cells (the organiser asked for them to go); the copy
 * carries no em dashes; the chips' names and prices come from
 * content/passes.ts.
 */

const TICKER = ['REGISTRATIONS · CLOSED', 'SEATS LOCKED IN', '30.10.2026 · VJIT HYDERABAD', 'TICKETS OUT 28 OCTOBER', 'SEE YOU THERE']

/** One run of the ticker. Two sit side by side so the -50% march loops without a seam. */
function TickerRun() {
  return (
    <span style={{ display: 'flex', gap: '26px', paddingRight: '26px', whiteSpace: 'nowrap' }}>
      {TICKER.map((t) => (
        <span key={t} style={{ display: 'contents' }}>
          <span>{t}</span>
          <span style={{ color: '#9FE3B6' }}>◆</span>
        </span>
      ))}
    </span>
  )
}

export default async function RegisterPage() {
  // While the code flag is off a production build keeps this page static.
  // Otherwise it asks the table on every request, never at build time: the
  // admin switch has to take effect on the next load.
  if (REGISTRATION_OPEN || process.env.NODE_ENV !== 'production') {
    await connection()
    if (await registrationIsOpen()) return <Flow />
  }

  return (
    <div data-dc="1" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* The drifting grid. It must stay OUTSIDE any transformed ancestor:
          a transform makes position:fixed resolve against that ancestor. */}
      <div className="rg-grid" aria-hidden="true" />

      <header style={{ position: 'sticky', top: '0', zIndex: '40', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '12px clamp(14px,5vw,56px)', background: 'var(--surface)', borderBottom: '3px solid var(--line)' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,6vw,32px)', color: 'var(--ink)' }}>
          SCD<span style={{ color: 'var(--amber-ink)' }}>.</span>HYD<span style={{ color: 'var(--mint-ink)' }}>26</span>
        </Link>
        <nav aria-label="Main" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,2vw,18px)', fontFamily: 'var(--font-display)', fontSize: 'clamp(16.3px,4vw,20px)' }}>
          <ThemeToggle />
          <Link href="/" style={{ color: 'var(--ink)' }}>
            ← HOME
          </Link>
          <Link href="/#passes" style={{ color: 'var(--ink)' }}>
            PASSES
          </Link>
        </nav>
      </header>

      <div aria-hidden="true" style={{ position: 'relative', zIndex: '10', overflow: 'hidden', background: '#14161C', borderBottom: '3px solid var(--line)' }}>
        <div style={{ display: 'flex', width: 'max-content', fontFamily: 'var(--font-mono)', fontSize: '11.5px', letterSpacing: '.2em', color: '#FF9900', padding: '9px 0', animation: 'rg-march 26s linear infinite' }}>
          <TickerRun />
          <TickerRun />
        </div>
      </div>

      <main
        id="main"
        style={{ position: 'relative', zIndex: '10', flex: '1', width: '100%', maxWidth: '1180px', margin: '0 auto', padding: 'clamp(32px,7vh,80px) clamp(16px,5vw,56px) clamp(48px,9vh,96px)', boxSizing: 'border-box', display: 'grid', gap: 'clamp(28px,5vw,64px)', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', alignItems: 'center' }}
      >
        <LockedHero />
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px,3vh,26px)', minWidth: '0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.2em', textTransform: 'uppercase' }}>
            <span style={{ background: '#FF9900', color: '#14161C', padding: '5px 8px', fontWeight: '600', whiteSpace: 'nowrap', animation: 'rg-glow 2.4s ease-in-out infinite' }}>STATUS: CLOSED</span>
            <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              SEATS LOCKED IN<span style={{ animation: 'rg-blink 1s steps(1) infinite', color: 'var(--mint-ink)' }}>_</span>
            </span>
          </div>
          <h1 style={{ margin: '0', fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,7.2vw,92px)', lineHeight: '.9', minWidth: '0', overflowWrap: 'anywhere', color: 'var(--ink)', textShadow: '4px 4px 0 var(--h-sh)' }}>
            REGISTRATIONS
            <br />
            <span style={{ color: 'var(--amber-ink)' }}>CLOSED</span>
          </h1>
          <p style={{ margin: '0', maxWidth: '46ch', fontSize: 'clamp(15px,3.8vw,17.5px)', lineHeight: '1.62', color: 'var(--body)', textWrap: 'pretty' }}>
            Registrations for {event.name} are now closed. Thank you to everyone who signed up. If you registered, your seat is locked in: your ticket
            reaches your inbox on 28 October, two days before the event.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            <Link
              href="/#speakers"
              className="btn btn-primary"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(19px,4.6vw,22px)' }}
            >
              MEET THE SPEAKERS →
            </Link>
            <a href="https://www.instagram.com/awssbg_vjit" target="_blank" rel="noopener noreferrer" className="btn" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(19px,4.6vw,22px)' }}>
              FOLLOW @AWSSBG_VJIT
            </a>
          </div>
          <p style={{ margin: '0', fontSize: '13.5px', lineHeight: '1.55', color: 'var(--muted)' }}>
            Registered but cannot find your mail? Write to <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a> with your pass ID.
          </p>
        </section>
      </main>

      <section style={{ position: 'relative', zIndex: '10', borderTop: '3px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: 'clamp(28px,5vh,52px) clamp(16px,5vw,56px)', display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '3px solid var(--line)', background: 'var(--surface)', padding: '16px 18px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', color: 'var(--mint-ink)' }}>✓ REGISTRATION</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)' }}>CLOSED · SEATS LOCKED IN</span>
            <span style={{ fontSize: '13.5px', color: 'var(--body)' }}>Thank you for the response.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '3px solid var(--line)', background: 'var(--surface)', padding: '16px 18px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', color: 'var(--amber-ink)' }}>🎟 TICKETS</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)' }}>OUT 28 OCTOBER</span>
            <span style={{ fontSize: '13.5px', color: 'var(--body)' }}>By email, to the address you registered with.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '3px solid var(--line)', background: 'var(--surface)', padding: '16px 18px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.2em', color: 'var(--mint-ink)' }}>◆ THE DAY</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--ink)' }}>30 OCTOBER · VJIT</span>
            <span style={{ fontSize: '13.5px', color: 'var(--body)' }}>Doors at {doorsLabel}. Bring your ticket QR.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
