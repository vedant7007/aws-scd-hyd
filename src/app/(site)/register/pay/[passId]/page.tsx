import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { PayStep, Received } from '@/components/register/PayStep'
import { event } from '@/content/event'
import { formatInr } from '@/content/passes'
import { payment } from '@/content/payment'
import { normalisePassId } from '@/lib/db/keys'
import { getAttendee } from '@/lib/db/queries'
import { VERIFICATION_WINDOW } from '@/lib/email/templates'

export const metadata: Metadata = {
  title: `Pay for your pass, ${event.shortName}`,
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

/**
 * Amendment 1 section 2. Where the form sends the student, and where they
 * come back to after paying in their UPI app, or after a rejection. By pass
 * id alone: no email exists before the UTR is in, so the id shown on screen
 * is the only thing they can carry across the gap.
 *
 *   AWAITING_PAYMENT, REJECTED   the QR, the amount, the UTR form
 *   PENDING_VERIFICATION         "we have your UTR", nothing else to do
 *   VERIFIED, SESSIONS_SELECTED  the pass itself
 *   ABANDONED                    the hold lapsed; register again
 *   anything else                not found
 */
export default async function PayPage({ params }: PageProps<'/register/pay/[passId]'>) {
  const { passId: raw } = await params
  const passId = normalisePassId(raw)
  if (!passId) notFound()
  if (passId !== raw) redirect(`/register/pay/${passId}`)

  const attendee = await getAttendee(passId)
  if (!attendee) notFound()

  if (attendee.state === 'VERIFIED' || attendee.state === 'SESSIONS_SELECTED') redirect(`/pass/${passId}`)

  if (attendee.state === 'PENDING_VERIFICATION') {
    return (
      <Container className="section-tight">
        <Received passId={passId} verificationWindow={VERIFICATION_WINDOW} contactEmail={event.contactEmail} />
      </Container>
    )
  }

  if (attendee.state === 'ABANDONED') {
    return (
      <Container className="section-tight flex flex-col gap-6">
        <p className="eyebrow">Expired</p>
        <h1 className="display text-step-3">This registration ran out of time</h1>
        <p className="measure text-muted">
          No UTR arrived within the hour, so the place was released. If you did pay, write to {event.contactEmail} with your UTR and pass
          ID {passId} and we will put it back. Otherwise, register again.
        </p>
      </Container>
    )
  }

  return (
    <Container className="section-tight">
      <header className="enter">
        <p className="eyebrow">Register</p>
        <h1 className="display text-step-3 mt-2">Almost there</h1>
      </header>
      <div className="mt-10">
        <PayStep
          passId={passId}
          amountLabel={formatInr(attendee.amountPaise)}
          qr={payment.qrAssetPath}
          upiId={payment.upiId}
          payee={payment.payeeName}
          verificationWindow={VERIFICATION_WINDOW}
          rejectedReason={attendee.state === 'REJECTED' ? (attendee.rejectionReason ?? '') : null}
          previousUtr={attendee.state === 'REJECTED' ? (attendee.utr ?? null) : null}
          contactEmail={event.contactEmail}
        />
      </div>
    </Container>
  )
}
