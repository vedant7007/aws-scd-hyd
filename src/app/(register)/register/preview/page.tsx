import type { Metadata } from 'next'
import { Flow } from '@/components/register/Flow'
import { requireAdmin } from '@/lib/auth/admin'

export const metadata: Metadata = {
  title: 'Registration preview',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The real registration flow for a signed-in admin while registration is
 * closed to the public. Everything is live: the hold claims seats, the
 * screenshot uploads, the submit sends email 1. The records are marked
 * preview so no count reads them. Anyone else is sent to sign in.
 */
export default async function RegisterPreviewPage() {
  await requireAdmin()
  return <Flow preview />
}
