'use client'

import { QRCodeSVG } from 'qrcode.react'

/**
 * Encodes the ticket ref and nothing else. The scanner looks it up, so the code
 * carries no personal data and stays low density, which matters when it is
 * being read off a cracked screen at a gate.
 *
 * Colours come from .qr-plate in globals.css, which pins a light plate in both
 * themes on purpose. currentColor keeps the modules in step with it.
 */
export function QrPass({ ticketRef }: { ticketRef: string }) {
  return (
    <div className="qr-plate">
      <QRCodeSVG
        value={ticketRef}
        bgColor="transparent"
        fgColor="currentColor"
        level="M"
        marginSize={0}
        title={`Pass code for ${ticketRef}`}
      />
    </div>
  )
}
