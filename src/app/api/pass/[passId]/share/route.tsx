import { ImageResponse } from 'next/og'
import { event, venue } from '@/content/event'
import { getAttendeeByToken } from '@/lib/db/queries'
import { ogTheme } from '@/lib/og-theme'

/**
 * The shareable "I'm attending" card, generated from the pass.
 *
 * Two sizes, because the two places students actually post are different
 * shapes: a 1080x1920 story and a 1200x627 landscape card for LinkedIn.
 *
 * It carries a first name and nothing else identifying. No ticket ref, no QR,
 * no email: this is made to be posted in public, so it must not leak anything
 * that gets someone through a gate.
 */
const SIZES = {
  story: { width: 1080, height: 1920 },
  card: { width: 1200, height: 627 },
} as const

type Format = keyof typeof SIZES

export async function GET(req: Request, ctx: RouteContext<'/api/pass/[token]/share'>): Promise<Response> {
  const { token } = await ctx.params
  const requested = new URL(req.url).searchParams.get('format')
  const format: Format = requested === 'card' ? 'card' : 'story'
  const size = SIZES[format]

  const attendee = await getAttendeeByToken(token)
  if (!attendee) {
    return new Response('This pass link is not valid.', {
      status: 404,
      headers: { 'cache-control': 'no-store' },
    })
  }

  const t = ogTheme()
  const firstName = attendee.name.trim().split(/\s+/)[0] ?? attendee.name
  const isStory = format === 'story'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: t.bg,
          color: t.text,
          padding: isStory ? 96 : 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', fontSize: isStory ? 44 : 28, color: t.muted }}>
            {event.host}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: isStory ? 150 : 76,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            I am going
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              fontSize: isStory ? 86 : 46,
              fontWeight: 800,
              letterSpacing: -2,
              color: t.accent,
            }}
          >
            {firstName}
          </div>
          <div style={{ display: 'flex', fontSize: isStory ? 56 : 32, fontWeight: 700, lineHeight: 1.1 }}>
            AWS Student Community Day {event.city}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: isStory ? 40 : 26,
            color: t.muted,
            borderTop: `2px solid ${t.border}`,
            paddingTop: isStory ? 32 : 20,
          }}
        >
          <div style={{ display: 'flex' }}>{event.dateLabel}</div>
          <div style={{ display: 'flex' }}>{venue.name}</div>
        </div>
      </div>
    ),
    size,
  )
}
