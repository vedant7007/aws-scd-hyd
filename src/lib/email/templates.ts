import { event, venue } from '../../content/event'
import { programSession } from '../../content/program'
import { REFUND_POLICY, formatInr, tierLabel } from '../../content/passes'
import type { Attendee } from '../db/types'
import { siteUrl } from '../site'
import type { Mail } from './send'

/**
 * Every body the site sends, in one place, so wording changes here and
 * nowhere else. All transactional, none of them market anything.
 *
 * The HTML is deliberately unstyled: no colours, no fonts, no images and no
 * tracking. Mail clients render semantic HTML perfectly well on a phone, and
 * an email with nothing to load is the one that arrives fastest and lands in
 * the inbox rather than promotions. The ticket's QR lives on the pass page
 * the confirmation links to, not in the mail.
 */

/**
 * How long a student is told verification takes. The v3 flow promises
 * "within 24h"; when the organiser says otherwise, only this changes. Never
 * promise instant.
 */
export const VERIFICATION_WINDOW = '24 hours'

/**
 * Words email 1 must never contain. Nobody has checked the money when it is
 * sent, and it is the only thing standing between us and fifty people at the
 * gate with a "confirmation" nobody verified. Enforced by the test suite.
 */
export const RECEIPT_FORBIDDEN_WORDS = ['successful', 'success', 'confirmed', 'confirmation', 'paid', 'complete', 'approved', 'verified'] as const

export const SUBJECTS = {
  receipt: `We have your details, ${event.shortName}`,
  confirmation: `Your ${event.shortName} ticket`,
  rejection: `We could not match your payment, ${event.shortName}`,
  dayBefore: `Tomorrow: ${event.shortName}`,
} as const

export const REPLY_TO = process.env.SES_REPLY_TO ?? event.contactEmail

type Body = Omit<Mail, 'to'>

/** Anything typed by a person goes into HTML, so it is escaped. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Derived from the one startsAt in content, never typed twice. */
const doors = new Date(event.startsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

/**
 * Links refuse to be built against a localhost origin. A student cannot open
 * http://localhost:3000/pass/... from their phone, and one of those going out
 * would be worse than no email at all.
 */
function link(path: string): string {
  const origin = siteUrl()
  if (/localhost|127\.0\.0\.1/.test(origin) && process.env.EMAIL_TRANSPORT === 'ses') {
    throw new Error(`Refusing to put a ${origin} link in a real email. Set NEXT_PUBLIC_SITE_URL.`)
  }
  return `${origin}${path}`
}
export const passLink = (passId: string) => link(`/pass/${passId}`)
export const payLink = (passId: string) => link(`/register/pay/${passId}`)

const footerText = `${event.host}\nReplies go to ${REPLY_TO}.\n${event.disclaimer}`
const footerHtml = `<hr><p>${esc(event.host)}<br>Replies go to ${esc(REPLY_TO)}.<br>${esc(event.disclaimer)}</p>`

type Person = Pick<Attendee, 'firstName' | 'passId' | 'tier' | 'technicalSession' | 'workshop' | 'amountPaise'>

/** The sessions a pass holds, as lines: "Technical: Cloud 101: ..." */
function sessionLines(r: Person): string[] {
  return [
    `Technical: ${programSession(r.technicalSession)?.title ?? r.technicalSession}`,
    ...(r.workshop ? [`Workshop: ${programSession(r.workshop)?.title ?? r.workshop}`] : []),
  ]
}

/**
 * EMAIL 1, on entering PENDING_VERIFICATION. Nothing here may read as a
 * confirmation. See RECEIPT_FORBIDDEN_WORDS.
 */
export function receipt(r: Person): Body {
  const lines = sessionLines(r)
  return {
    subject: SUBJECTS.receipt,
    text: `Hi ${r.firstName},

We have your details and your UTR for ${event.name}.

We will check your payment against the college bank statement within ${VERIFICATION_WINDOW}. When we have, we email you your ticket. Until then there is nothing you need to do.

YOUR PASS ID
${r.passId}

Keep it safe. It is how we find your registration.

YOUR PASS
${tierLabel(r.tier)}, ${formatInr(r.amountPaise)}
${lines.join('\n')}

If you have a question, reply to this email. Replies go to ${REPLY_TO}.

${footerText}`,
    html: `<p>Hi ${esc(r.firstName)},</p>
<p>We have your details and your UTR for ${esc(event.name)}.</p>
<p>We will check your payment against the college bank statement within ${VERIFICATION_WINDOW}. When we have, we email you your ticket. Until then there is nothing you need to do.</p>
<h2>Your pass ID</h2>
<p><strong>${esc(r.passId)}</strong></p>
<p>Keep it safe. It is how we find your registration.</p>
<h2>Your pass</h2>
<p>${esc(tierLabel(r.tier))}, ${esc(formatInr(r.amountPaise))}<br>${lines.map(esc).join('<br>')}</p>
<p>If you have a question, reply to this email. Replies go to ${esc(REPLY_TO)}.</p>
${footerHtml}`,
  }
}

/** EMAIL 2, the ticket, on entering VERIFIED. */
export function confirmation(r: Person): Body {
  const url = passLink(r.passId)
  const lines = sessionLines(r)
  return {
    subject: SUBJECTS.confirmation,
    text: `Hi ${r.firstName},

Your payment is checked and your ${tierLabel(r.tier)} pass for ${event.name} is confirmed.

YOUR TICKET
${url}

Open it on the day and show the QR at the gate. It is the same for every session.

YOUR PASS ID
${r.passId}

YOUR SESSIONS
${lines.join('\n')}

When:  ${event.dateLabel}, doors ${doors} IST
Where: ${venue.name}
Map:   ${venue.directionsUrl}

REFUNDS
${REFUND_POLICY}

${footerText}`,
    html: `<p>Hi ${esc(r.firstName)},</p>
<p>Your payment is checked and your <strong>${esc(tierLabel(r.tier))} pass</strong> for ${esc(event.name)} is confirmed.</p>
<h2>Your ticket</h2>
<p><a href="${url}"><strong>${url}</strong></a></p>
<p>Open it on the day and show the QR at the gate. It is the same for every session.</p>
<h2>Your pass ID</h2>
<p><strong>${esc(r.passId)}</strong></p>
<h2>Your sessions</h2>
<p>${lines.map(esc).join('<br>')}</p>
<h2>When and where</h2>
<p>${esc(event.dateLabel)}, doors ${doors} IST<br>${esc(venue.name)}<br><a href="${venue.directionsUrl}">Open in Google Maps</a></p>
<h2>Refunds</h2>
<p>${esc(REFUND_POLICY)}</p>
${footerHtml}`,
  }
}

/** REJECTION EMAIL, on entering REJECTED. Quotes the UTR, links the resubmission page, never the ticket. */
export function rejection(r: Person, utr: string, reason: string): Body {
  const url = payLink(r.passId)
  return {
    subject: SUBJECTS.rejection,
    text: `Hi ${r.firstName},

We could not match a payment to your registration for ${event.name}.

The UTR you submitted was ${utr}.
${reason ? `Note from the organisers: ${reason}\n` : ''}
Your sessions are still held. Check the UTR in your UPI app and submit the correct one here:
${url}

Or reply to this email with the correct UTR and a screenshot, quoting your pass ID ${r.passId}.

${footerText}`,
    html: `<p>Hi ${esc(r.firstName)},</p>
<p>We could not match a payment to your registration for ${esc(event.name)}.</p>
<p>The UTR you submitted was <strong>${esc(utr)}</strong>.</p>
${reason ? `<p>Note from the organisers: ${esc(reason)}</p>` : ''}
<p>Your sessions are still held. Check the UTR in your UPI app and <a href="${url}">submit the correct one here</a>.</p>
<p>Or reply to this email with the correct UTR and a screenshot, quoting your pass ID <strong>${esc(r.passId)}</strong>.</p>
${footerHtml}`,
  }
}

/** Sent the day before with timings and directions. */
export function dayBefore(r: Person): Body {
  const url = passLink(r.passId)
  return {
    subject: SUBJECTS.dayBefore,
    text: `Hi ${r.firstName},

See you tomorrow.

Doors:  ${doors} IST. Come early, the gate queue is the slow part.
Where:  ${venue.name}${venue.address ? `\n        ${venue.address}` : ''}
Map:    ${venue.directionsUrl}

YOUR TICKET
${url}

Open it before you arrive so it is loaded, then show the QR at the gate.

Lunch is included.

${footerText}`,
    html: `<p>Hi ${esc(r.firstName)},</p>
<p>See you tomorrow.</p>
<h2>Timings</h2>
<p>Doors <strong>${doors} IST</strong>. Come early, the gate queue is the slow part.</p>
<h2>Getting there</h2>
<p>${esc(venue.name)}${venue.address ? `<br>${esc(venue.address)}` : ''}<br><a href="${venue.directionsUrl}">Open in Google Maps</a></p>
<h2>Your ticket</h2>
<p><a href="${url}"><strong>${url}</strong></a></p>
<p>Open it before you arrive so it is loaded, then show the QR at the gate.</p>
<p>Lunch is included.</p>
${footerHtml}`,
  }
}
