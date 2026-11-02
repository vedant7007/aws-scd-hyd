import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShareCert } from '@/components/certificate/ShareCert'
import { certificate } from '@/content/certificate'
import { event } from '@/content/event'
import { certUrl, getCert } from '@/lib/certificates'

export const dynamic = 'force-dynamic'

/**
 * A certificate, public by its id: this page is also how anyone verifies one.
 * The image is the link preview, so a LinkedIn post shows the certificate.
 */
export async function generateMetadata({ params }: PageProps<'/certificate/[certId]'>): Promise<Metadata> {
  const cert = await getCert((await params).certId)
  if (!cert || cert.state !== 'ISSUED') return { title: 'Certificate', robots: { index: false } }
  const title = `${cert.certName}: ${certificate.title}`
  const description = `${cert.certName} participated in ${event.name} 2026, ${certificate.issued.label}. Certificate ID ${cert.certId}.`
  const image = { url: `/certificate/${cert.certId}/image`, width: 2000, height: 1414, alt: title }
  return { title, description, robots: { index: false }, openGraph: { title, description, images: [image] }, twitter: { card: 'summary_large_image', title, description, images: [image.url] } }
}

export default async function CertificateView({ params, searchParams }: PageProps<'/certificate/[certId]'>) {
  const cert = await getCert((await params).certId)
  if (!cert) notFound()
  const fresh = 'new' in (await searchParams)

  if (cert.state !== 'ISSUED') {
    return (
      <div className="page page-760 rise flex flex-col gap-4">
        <span className="eye">{'// CERTIFICATE ' + cert.certId}</span>
        <h1 className="h1">{cert.state === 'HELD' ? 'BEING CHECKED' : 'NOT VALID'}</h1>
        <p className="lede">
          {cert.state === 'HELD'
            ? 'An organiser is checking this one. The owner gets an email as soon as it is cleared.'
            : `This certificate was withdrawn by ${certificate.issuer} and is not valid.`}
        </p>
      </div>
    )
  }

  const url = certUrl(cert.certId)
  const image = `/certificate/${cert.certId}/image`
  const shareText = `I took part in ${event.name} 2026, organised by ${certificate.issuer}.`
  const addToProfile =
    'https://www.linkedin.com/profile/add?' +
    new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: certificate.linkedinName,
      organizationName: certificate.issuer,
      issueYear: String(certificate.issued.year),
      issueMonth: String(certificate.issued.month),
      certUrl: url,
      certId: cert.certId,
    })

  return (
    <div className="page page-1180 rise flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="eye">{fresh ? '// DONE. CONGRATULATIONS!' : '// VERIFIED CERTIFICATE'}</span>
        <h1 className="h1 h1-lg">{fresh ? 'HERE IT IS' : cert.certName.toUpperCase()}</h1>
        <p className="lede">
          {cert.certName} participated in <strong>{event.name} 2026</strong> on {certificate.issued.label}. Issued by {certificate.issuer}. Certificate ID <span className="num">{cert.certId}</span>.
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, already at full size */}
      <img src={image} width={2000} height={1414} alt={`${certificate.title} for ${cert.certName}`} className="card h-auto w-full" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <a href={`${image}?download=1`} download className="btn btn-primary">
          DOWNLOAD PNG
        </a>
        <a href={addToProfile} target="_blank" rel="noopener noreferrer" className="btn btn-mint">
          ADD TO LINKEDIN PROFILE
        </a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="btn">
          POST ON LINKEDIN
        </a>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`} target="_blank" rel="noopener noreferrer" className="btn">
          SHARE ON WHATSAPP
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ShareCert url={url} text={shareText} />
        <span className="hint">Anyone with this link can verify the certificate.</span>
      </div>

      {fresh ? (
        <p className="lede">
          We also emailed you this link. Wrong name? <Link href="/certificate" className="underline">Send the form again</Link> with the same pass ID and survey ID to fix it.
        </p>
      ) : null}
    </div>
  )
}
