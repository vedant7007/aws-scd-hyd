'use client'

import { useState } from 'react'

/** Copy the link, or the phone's own share sheet where there is one. */
export function ShareCert({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: text, text, url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button type="button" onClick={share} className="btn">
      {copied ? 'LINK COPIED ✓' : 'SHARE / COPY LINK'}
    </button>
  )
}
