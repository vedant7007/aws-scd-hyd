'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Counts one page view per route change, for the admin TRAFFIC page.
 *
 * Mounted once in the root layout so it covers the landing (which carries its
 * own chrome) and every public page alike. It sends the path, whether this is
 * the first page of the tab's session, and, on that first page only, the site
 * the visitor came from. Nothing else leaves the browser, and nothing is kept
 * in a cookie.
 *
 * Crew pages are not counted: organisers checking the dashboard are not
 * traffic. A browser asking not to be tracked is taken at its word.
 */

const SEEN = 'scd-visit'

export function Beacon() {
  const path = usePathname()

  useEffect(() => {
    if (!path || path.startsWith('/admin')) return
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null }
    if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return

    // A visit is the first page view in this tab. sessionStorage clears when
    // the tab closes, which is exactly the lifetime a visit should have.
    let visit = false
    try {
      visit = sessionStorage.getItem(SEEN) === null
      sessionStorage.setItem(SEEN, '1')
    } catch {
      // Storage blocked: every view counts as a view, none as a visit. Fine.
    }

    let ref = ''
    if (visit && document.referrer) {
      try {
        if (new URL(document.referrer).host !== location.host) ref = document.referrer
      } catch {
        // An unparseable referrer is simply not recorded.
      }
    }

    const body = JSON.stringify({ path, ref, visit })
    // sendBeacon survives the page being navigated away from; fetch with
    // keepalive is the fallback where it is missing or refuses the payload.
    if (!navigator.sendBeacon?.('/api/hit', body)) {
      void fetch('/api/hit', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  }, [path])

  return null
}
