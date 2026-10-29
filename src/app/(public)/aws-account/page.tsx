import type { Metadata } from 'next'
import { event } from '@/content/event'

export const metadata: Metadata = {
  title: 'Make your AWS account',
  description: `How to make your AWS account before ${event.name}: a short video, eight steps and a PDF guide.`,
}

const VIDEO = '/assets/aws-account-how-to.mp4'
const POSTER = '/assets/aws-account-how-to.jpg'
const GUIDE = '/assets/aws-account-guide.pdf'

/** The same eight steps as the PDF guide and the day-before email. */
const STEPS = [
  ['OPEN THE SIGN-UP PAGE', 'On your laptop go to aws.amazon.com and click Create an AWS Account. Offered sign-up with Google or GitHub? Take it, it usually needs no card.'],
  ['EMAIL AND PASSWORD', 'Type your own email, enter the code AWS sends you, then set a strong password and save it.'],
  ['YOUR DETAILS', 'Choose Personal. Name, phone and address as on your ID. Country: India.'],
  ['PICK THE FREE PLAN', 'Nothing is charged unless you choose to upgrade later.'],
  ['CARD CHECK, IF ASKED', 'AWS may charge INR 2 to check your card and refunds it. If the payment fails, turn on online and international payments in your bank app.'],
  ['PHONE OTP', 'Enter your mobile with +91 and type the code from the SMS. No SMS? Choose the call option.'],
  ['BASIC SUPPORT', 'Choose Basic support, free. Do not pick a paid plan.'],
  ['SIGN IN ONCE', 'Go to console.aws.amazon.com, choose Root user and sign in. See the console home page? You are done.'],
] as const

export default function AwsAccountPage() {
  return (
    <div className="page page-760 rise">
      <div className="flex flex-col gap-3.5">
        <span className="eye">{'// FOR THE HANDS-ON WORKSHOPS'}</span>
        <h1 className="h1 h1-lg">MAKE YOUR AWS ACCOUNT</h1>
        <p className="lede">
          Ten to fifteen minutes on your laptop, with your phone next to you for the codes. Sign-up can need an OTP and a card check, and campus Wi-Fi on the day is the worst place to wait for that.
        </p>
      </div>

      <video src={VIDEO} poster={POSTER} controls playsInline preload="metadata" className="card block w-full">
        <a href={VIDEO}>Watch the video</a>
      </video>

      <div className="card card-orange flex flex-col gap-2 p-4">
        <span className="h3">PREMIUM, PLATINUM AND VIP: HANDS-ON WORKSHOP</span>
        <p className="copy">You need this account for your workshop. Bring your laptop fully charged and its charger. Charging points are limited.</p>
      </div>

      <section className="flex flex-col gap-3.5" aria-labelledby="steps-h">
        <h2 id="steps-h" className="h2">
          EIGHT STEPS
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="card flex flex-col gap-1.5 p-4">
              <span className="h3">
                {String(i + 1).padStart(2, '0')} · {title}
              </span>
              <p className="copy">{body}</p>
            </li>
          ))}
        </ol>
        <p className="hint">Stay safe: turn on MFA (your name, top right, then Security credentials), and never share your password, codes or access keys. We will never ask for them.</p>
      </section>

      <a href={GUIDE} target="_blank" rel="noopener" className="btn btn-primary btn-lg self-start">
        DOWNLOAD THE PDF GUIDE
      </a>
      <p className="hint">Stuck? Write to {event.contactEmail} today.</p>
    </div>
  )
}
