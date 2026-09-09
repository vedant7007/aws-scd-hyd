import { ImageResponse } from 'next/og'
import { event, venue } from '@/content/event'
import { ogTheme } from '@/lib/og-theme'

export const alt = `${event.name}, ${event.dateLabel}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Site wide link preview. Colours come from the theme file, not from here. */
export default function OpengraphImage() {
  const t = ogTheme()

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
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: t.muted }}>{event.host}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
            AWS Student
          </div>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
            Community Day
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              color: t.accent,
            }}
          >
            {event.city}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, color: t.muted }}>
          <div style={{ display: 'flex' }}>{event.dateLabel}</div>
          <div style={{ display: 'flex' }}>{venue.name}</div>
        </div>
      </div>
    ),
    size,
  )
}
