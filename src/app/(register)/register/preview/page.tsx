import type { Metadata } from 'next'
import { Flow } from '@/components/register/Flow'

export const metadata: Metadata = {
  title: 'Register',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The test registration: the real flow, exactly as students see it, open to
 * anyone with the link (never linked, never indexed, disallowed in
 * robots.txt). The one difference is where the money goes: these records
 * pay the organiser's test UPI account (SCD_UPI_TEST_ID), and they are
 * marked preview, so they are verified and emailed like any other but no
 * count or caterer total reads them.
 */
export default function RegisterPreviewPage() {
  return <Flow preview />
}
