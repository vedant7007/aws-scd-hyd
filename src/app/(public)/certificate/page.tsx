import type { Metadata } from 'next'
import { ClaimForm } from '@/components/certificate/ClaimForm'
import { certificate } from '@/content/certificate'
import { event } from '@/content/event'
import { normalisePassId } from '@/lib/db/keys'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Get your certificate',
  description: `Fill the AWS survey, show us the submission, and get your ${event.name} certificate to download and add to LinkedIn.`,
}

/** Feedback in, proof in, certificate out. ?pass= fills the pass ID from the email link. */
export default async function CertificatePage({ searchParams }: PageProps<'/certificate'>) {
  const raw = (await searchParams).pass
  const pass = normalisePassId(Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')) ?? ''

  return (
    <div className="page page-760 rise flex flex-col gap-7">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// AFTER THE EVENT'}</span>
        <h1 className="h1 h1-lg">GET YOUR CERTIFICATE</h1>
        <p className="lede">Two steps: fill the AWS event survey, then show us the submission here. Your certificate is made on the spot, ready to download, add to LinkedIn and share. The same survey also counts for your AWS Credly badge.</p>
      </div>
      <ClaimForm initialPass={pass} survey={certificate.survey} />
    </div>
  )
}
