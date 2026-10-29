'use client'

import { QRCodeSVG } from 'qrcode.react'
import { gateLink } from '@/lib/site'

/**
 * Encodes the gate link for the pass and nothing else (lib/site.ts gateLink).
 * The scanner pulls the pass id out of it and looks it up, so the code
 * carries no personal data; a phone camera opens the staff page.
 *
 * Colours come from .qr-plate in globals.css, which pins a light plate in both
 * themes on purpose. currentColor keeps the modules in step with it.
 */
export function QrPass({ passId }: { passId: string }) {
  return (
    <span className="qr-plate">
      <QRCodeSVG value={gateLink(passId)} bgColor="transparent" fgColor="currentColor" level="M" marginSize={0} title={`Pass code ${passId}`} />
    </span>
  )
}
