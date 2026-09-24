import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PassIdNote, PayStep, Received } from '@/components/register/PayStep'
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
 * Amendment 1 section 2. PARKED with the rest of the payment flow while
 * registration is closed: nothing public links here. Where the form sends
 * the student, and where they
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
export default async function PayPage({ params }: PageProps<'/register-legacy/pay/[passId]'>) {
  const { passId: raw } = await params
  const passId = normalisePassId(raw)
  if (!passId) notFound()
  if (passId !== raw) redirect(`/register-legacy/pay/${passId}`)

  const attendee = await getAttendee(passId)
  if (!attendee) notFound()

  if (attendee.state === 'VERIFIED' || attendee.state === 'SESSIONS_SELECTED') redirect(`/pass/${passId}`)

  if (attendee.state === 'PENDING_VERIFICATION') {
    return (
      <div className="page rise">
        <Received passId={passId} verificationWindow={VERIFICATION_WINDOW} contactEmail={event.contactEmail} />
      </div>
    )
  }

  if (attendee.state === 'ABANDONED') {
    return (
      <div className="page rise">
        <div className="flex flex-col items-start gap-4">
          <span className="pill pill-err">Expired</span>
          <h1 className="h1">THIS REGISTRATION RAN OUT OF TIME</h1>
          <p className="lede">
            No UTR arrived within the hour, so the place was released. If you did pay, write to {event.contactEmail} with your UTR and
            the pass ID below and we will put it back. Otherwise, register again.
          </p>
          <PassIdNote passId={passId} />
          <Link href="/register" className="btn btn-primary">
            REGISTER AGAIN
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page rise">
      <div className="flex flex-col gap-3">
        <span className="eye">{'// REGISTER'}</span>
        <h1 className="h1">ALMOST THERE</h1>
        <p className="lede">Keep the pass ID below. It is how we find your registration, and it opens your pass once the payment is checked.</p>
      </div>
      <PassIdNote passId={passId} />
      {attendee.earlyBirdMissed ? (
        <p role="status" className="card-dash copy px-4 py-3">
          Early bird just ran out a moment before your registration, so the price is the normal {formatInr(attendee.amountPaise)}. Nothing else
          changes.
        </p>
      ) : null}
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
  )
}
