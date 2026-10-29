import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { GateDesk } from '@/components/admin/GateDesk'
import { currentCrew } from '@/lib/auth/admin'
import { normalisePassId } from '@/lib/db/keys'

export const metadata: Metadata = { title: 'Gate', robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

/**
 * Where every ticket QR points (lib/site.ts gateLink). Signed-in crew, admin
 * or volunteer, get the gate desk for that pass: who it is, and the check in,
 * swag, lunch token and light food buttons. Anyone else is sent to the
 * attendee's own ticket. What a scan does can change here at any time; the
 * QR on every ticket stays the same.
 */
export default async function GatePage({ params }: PageProps<'/g/[passId]'>) {
  const raw = (await params).passId
  const ref = normalisePassId(raw)
  if (!ref) redirect('/')
  const session = await currentCrew()
  if (session.status !== 'ok') redirect(`/pass/${ref}`)
  return <GateDesk passId={ref} />
}
