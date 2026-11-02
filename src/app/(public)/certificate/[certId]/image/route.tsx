import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { certificate } from '@/content/certificate'
import { event, venue } from '@/content/event'
import { certUrl, getCert } from '@/lib/certificates'

/**
 * The certificate as a PNG, A4 landscape at 2000 x 1414. It is the image the
 * page shows, the file people download, and the LinkedIn preview. ?download=1
 * sends it as an attachment. A withdrawn or held certificate has no image.
 */
const W = 2000
const H = 1414
const INK = '#14161C'
const ORANGE = '#FF9900'
const CREAM = '#F5F2EE'
const MUTED = '#5A6070'
const MINT = '#1F6540'

export async function GET(req: Request, ctx: RouteContext<'/certificate/[certId]/image'>): Promise<Response> {
  const { certId } = await ctx.params
  const cert = await getCert(certId)
  if (!cert || cert.state !== 'ISSUED') return new Response('No certificate here.', { status: 404, headers: { 'cache-control': 'no-store' } })

  const url = certUrl(cert.certId)
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: INK, light: '#FFFFFF' } })
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`
  const nameSize = cert.certName.length > 34 ? 92 : cert.certName.length > 24 ? 112 : 136
  const download = new URL(req.url).searchParams.has('download')

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', background: CREAM, padding: 48, fontFamily: 'sans-serif', color: INK }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `10px solid ${INK}`, background: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: INK, padding: '34px 64px', color: '#FFFFFF' }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, letterSpacing: 2 }}>
              SCD<span style={{ color: ORANGE }}>.</span>HYD<span style={{ color: '#9FE3B6' }}>26</span>
            </div>
            <div style={{ display: 'flex', fontSize: 28, letterSpacing: 6, color: '#9FE3B6' }}>30.10.2026</div>
          </div>
          <div style={{ display: 'flex', height: 18, background: ORANGE }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 120px', textAlign: 'center' }}>
            <div style={{ display: 'flex', fontSize: 30, letterSpacing: 12, color: MINT, textTransform: 'uppercase' }}>{certificate.title}</div>
            <div style={{ display: 'flex', marginTop: 40, fontSize: 38, color: MUTED }}>This certifies that</div>
            <div style={{ display: 'flex', marginTop: 24, fontSize: nameSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{cert.certName}</div>
            <div style={{ display: 'flex', width: 900, height: 8, marginTop: 28, background: ORANGE }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40, fontSize: 38, lineHeight: 1.45, color: INK }}>
              <span>participated in</span>
              <span style={{ fontWeight: 800 }}>{event.name} 2026</span>
              <span>
                held on {certificate.issued.label} at {venue.name}, Hyderabad
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 64px 52px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 56 }}>
                {certificate.signatories.map((s) => (
                  <div key={s.name} style={{ display: 'flex', flexDirection: 'column', width: 360, borderTop: `4px solid ${INK}`, paddingTop: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 800 }}>{s.name}</span>
                    <span style={{ fontSize: 22, color: MUTED }}>{s.title}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>Organised by {certificate.issuer}</div>
              <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>
                Certificate ID {cert.certId} · Verify at {url.replace(/^https?:\/\//, '')}
              </div>
            </div>
            <div style={{ display: 'flex', padding: 12, border: `4px solid ${INK}`, background: '#FFFFFF' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
              <img src={qrSrc} width={180} height={180} alt="" />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        'cache-control': 'public, max-age=300',
        ...(download ? { 'content-disposition': `attachment; filename="SCD-HYD-2026-certificate-${cert.certId}.png"` } : {}),
      },
    },
  )
}
