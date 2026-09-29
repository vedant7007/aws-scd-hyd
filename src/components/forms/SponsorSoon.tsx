import Link from 'next/link'
import { event } from '@/content/event'

/**
 * Parked at the organisers' request: sponsorship details are not ready, so
 * this says coming soon and gives the address. The v3 Sponsor form comes
 * back when they are.
 */
export function SponsorSoon() {
  return (
    <div data-dc="1" style={{ position: 'relative', zIndex: '10', width: '100%', maxWidth: '720px', margin: '0 auto', padding: 'clamp(22px,6vw,44px) clamp(16px,5vw,28px) 80px', display: 'flex', flexDirection: 'column', gap: '22px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mint-ink)' }}>{'// BACK THE DAY'}</span>
        <h1 style={{ margin: '0', fontWeight: '400', fontFamily: 'var(--font-display)', fontSize: 'clamp(35px,10vw,60px)', lineHeight: '1', color: 'var(--ink)' }}>SPONSOR US</h1>
      </div>
      <div style={{ border: '4px solid #FF9900', background: 'var(--panel-gold)', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.18em', textTransform: 'uppercase', background: '#FF9900', color: '#14161C', padding: '6px 10px' }}>Coming soon</span>
        <p style={{ margin: '0', fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,7vw,36px)', lineHeight: '1.05', color: 'var(--ink)' }}>SPONSORSHIP DETAILS ARE ON THEIR WAY</p>
        <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', color: 'var(--body)', maxWidth: '54ch' }}>
          We are putting the packages together now. If you already know you want to back the day, write to{' '}
          <a href={`mailto:${event.contactEmail}?subject=${encodeURIComponent('Sponsorship')}`}>{event.contactEmail}</a> and we will come back to you.
        </p>
      </div>
      <Link href="/speak" style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', minHeight: '44px', padding: '0 13px', border: '3px solid var(--line-soft)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
        Want to speak instead? →
      </Link>
    </div>
  )
}
