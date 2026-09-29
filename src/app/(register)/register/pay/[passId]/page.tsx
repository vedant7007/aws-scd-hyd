import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Flow, type Resume } from '@/components/register/Flow'
import { accountFor, upiLink } from '@/content/payment'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'

export const metadata: Metadata = {
  title: 'Pay for your pass',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

/** A hold whose ninety minutes are up, still awaiting the hourly sweep. */
const lapsed = (holdUntil: string | undefined) => !holdUntil || Date.parse(holdUntil) <= Date.now()

/**
 * The payment step on its own: the rejection email links here, and so does
 * anything that has only a pass id. Renders for a record waiting for a
 * payment (a live hold) or a rejected one (seats still held, a corrected
 * UTR wanted). Every other state, and an unknown id, is the same 404.
 */
export default async function PayPage({ params }: PageProps<'/register/pay/[passId]'>) {
  const { passId: raw } = await params
  const passId = normalisePassId(raw)
  if (!passId) notFound()
  if (passId !== raw) redirect(`/register/pay/${passId}`)

  const a = await getAttendee(passId)
  if (!a) notFound()
  const payable = a.state === 'REJECTED' || (a.state === 'AWAITING_PAYMENT' && !lapsed(a.holdUntil))
  if (!payable) notFound()

  const resume: Resume = {
    hold: {
      passId: a.passId,
      holdEnds: a.state === 'AWAITING_PAYMENT' ? Date.parse(a.holdUntil!) : 0,
      amountPaise: a.amountPaise,
      payee: null,
      link: accountFor(a.source) ? upiLink(accountFor(a.source)!, a.amountPaise, a.passId) : null,
    },
    tier: a.tier,
    tech: a.technicalSession,
    workshop: a.workshop ?? '',
    first: a.firstName,
    email: a.email,
    rejection: a.state === 'REJECTED' ? (a.rejectionReason ?? 'The UTR did not match a payment in the college statement.') : null,
  }
  return <Flow preview={a.source === 'preview'} resume={resume} />
}
