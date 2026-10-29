import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { doorsLabel, event, venue } from '../../content/event'
import { tierLabel } from '../../content/passes'
import type { Attendee } from '../db/types'
import { gateLink } from '../site'
import type { MailAttachment } from './send'

/** What the ticket email's HTML points its <img> at. */
export const TICKET_CID = 'ticket-image'

type Who = Pick<Attendee, 'name' | 'passId' | 'tier' | 'college'>

/**
 * The ticket as a picture: the gate QR on a white plate, the name, the pass
 * and the day. A picture because mail clients in dark mode recolour HTML, a
 * QR drawn in table cells turned grey in Gmail, and nobody recolours an
 * image. Sent twice in one mail: inline, so it shows in the message, and as
 * a PNG to save.
 */
export async function ticketImages(a: Who): Promise<MailAttachment[]> {
  const qr = await QRCode.toDataURL(gateLink(a.passId), { errorCorrectionLevel: 'M', margin: 2, scale: 14, color: { dark: '#000000', light: '#FFFFFF' } })
  const res = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#14161C', color: '#F4F7FB', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '44px 56px 32px' }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, letterSpacing: 2 }}>
            SCD<span style={{ color: '#FF9900' }}>.</span>HYD<span style={{ color: '#9FE3B6' }}>26</span>
          </div>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: '#9FE3B6' }}>ADMIT ONE</div>
        </div>
        <div style={{ display: 'flex', height: 12, background: '#FF9900' }} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 56px 0' }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, color: '#B8C4D6' }}>{event.name.toUpperCase()}</div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: a.name.length > 22 ? 58 : 72, fontWeight: 700, lineHeight: 1.05 }}>{a.name}</div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 28, color: '#B8C4D6' }}>{a.college.slice(0, 60)}</div>
          <div style={{ display: 'flex', marginTop: 20 }}>
            <div style={{ display: 'flex', padding: '8px 18px', background: '#F6D27A', color: '#14161C', fontSize: 28, fontWeight: 700, letterSpacing: 3 }}>{tierLabel(a.tier).toUpperCase()} PASS</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <div style={{ display: 'flex', padding: 22, background: '#FFFFFF', border: '6px solid #FF9900' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori draws plain img */}
            <img src={qr} width={520} height={520} alt="" />
          </div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 52, fontWeight: 700, letterSpacing: 6 }}>{a.passId}</div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 24, letterSpacing: 4, color: '#9FE3B6' }}>SHOW THIS QR AT THE GATE</div>
        </div>
        <div style={{ display: 'flex', margin: '44px 56px 0', borderTop: '3px dashed #3A4256', paddingTop: 30 }}>
          {[
            ['DATE', '30 OCT 2026'],
            ['DOORS', `${doorsLabel} IST`],
            ['VENUE', 'VJIT, AZIZNAGAR'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, color: '#B8C4D6' }}>{k}</div>
              <div style={{ display: 'flex', marginTop: 8, fontSize: 32, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', padding: '0 56px 40px', fontSize: 22, color: '#7E8BA3' }}>
          {venue.name} · awsscdhyd.in · Lunch included
        </div>
      </div>
    ),
    { width: 1080, height: 1500 },
  )
  const png = new Uint8Array(await res.arrayBuffer())
  return [
    { filename: `ticket-${a.passId}.png`, contentType: 'image/png', content: png, contentId: TICKET_CID },
    { filename: `AWS-SCD-Hyderabad-ticket-${a.passId}.png`, contentType: 'image/png', content: png },
  ]
}
