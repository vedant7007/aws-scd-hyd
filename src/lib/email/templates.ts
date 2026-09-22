import { event, venue } from '../../content/event'
import { tierLabel } from '../../content/passes'
import { roomById, trackName } from '../../content/sessions'
import { slotTime } from '../utils'
import type { Attendee, Session, Slot } from '../db/types'
import { siteUrl } from '../site'
import type { Mail } from './send'

/**
 * Amendment 1 section 3. Every body the site sends, in one place, so wording
 * changes here and nowhere else. All transactional, none of them market
 * anything.
 *
 * The HTML is deliberately unstyled: no colours, no fonts, no images and no
 * tracking. Mail clients render semantic HTML perfectly well on a phone, and
 * an email with nothing to load is the one that arrives fastest and lands in
 * the inbox rather than promotions. It also means the theme file stays the
 * only place a colour lives.
 */

/**
 * How long a student is told verification takes. The organiser has not yet
 * said how often the bank statement is checked; when they do, only this
 * changes. Never promise instant.
 */
export const VERIFICATION_WINDOW = '24 hours'

/**
 * Words email 1 must never contain. Nobody has checked the money when it is
 * sent, and it is the only thing standing between us and fifty people at the
 * gate with a "confirmation" nobody verified. Enforced by the test suite.
 */
export const RECEIPT_FORBIDDEN_WORDS = ['successful', 'success', 'confirmed', 'confirmation', 'paid', 'complete', 'approved', 'verified'] as const

export const SUBJECTS = {
  receipt: `We have received your registration, ${event.shortName}`,
  confirmation: `Your ${event.shortName} pass`,
  sessionsLive: `Choose your sessions, ${event.shortName}`,
  passReady: `Your ${event.shortName} pass is ready`,
  rejection: `We could not match your payment, ${event.shortName}`,
  dayBefore: `Tomorrow: ${event.shortName}`,
} as const

export const REPLY_TO = process.env.SES_REPLY_TO ?? event.contactEmail

type Body = Omit<Mail, 'to'>

/** Provider supplied names go into HTML, so they are escaped. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

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

type Person = Pick<Attendee, 'name' | 'passId' | 'tier' | 'homeTrack'>

/**
 * EMAIL 1, on entering PENDING_VERIFICATION. Nothing here may read as a
 * confirmation. See RECEIPT_FORBIDDEN_WORDS.
 */
export function receipt(r: Person): Body {
  return {
    subject: SUBJECTS.receipt,
    text: `Hi ${firstName(r.name)},

We have received your registration for ${event.name}.

We are now checking your payment against our bank records. You will hear from us within ${VERIFICATION_WINDOW}. Until then there is nothing you need to do.

YOUR PASS ID
${r.passId}

Keep it safe. It is how we find your registration, and it will open your pass once we have checked the payment.

If you have a question, reply to this email. Replies go to ${REPLY_TO}.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>We have received your registration for ${esc(event.name)}.</p>
<p>We are now checking your payment against our bank records. You will hear from us within ${VERIFICATION_WINDOW}. Until then there is nothing you need to do.</p>
<h2>Your pass ID</h2>
<p><strong>${esc(r.passId)}</strong></p>
<p>Keep it safe. It is how we find your registration, and it will open your pass once we have checked the payment.</p>
<p>If you have a question, reply to this email. Replies go to ${esc(REPLY_TO)}.</p>
${footerHtml}`,
  }
}

/** EMAIL 2, on entering VERIFIED. */
export function confirmation(r: Person): Body {
  const url = passLink(r.passId)
  return {
    subject: SUBJECTS.confirmation,
    text: `Hi ${firstName(r.name)},

Your registration is confirmed. Your ${tierLabel(r.tier)} pass for ${event.name} is yours.

YOUR PASS ID
${r.passId}

OPEN YOUR PASS
${url}

Your track is ${trackName(r.homeTrack)}. Sessions for it are announced closer to the day, and you will get an email the moment you can choose yours.

When:  ${event.dateLabel}, doors ${doors} IST
Where: ${venue.name}
Map:   ${venue.directionsUrl}

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>Your registration is confirmed. Your <strong>${esc(tierLabel(r.tier))} pass</strong> for ${esc(event.name)} is yours.</p>
<h2>Your pass ID</h2>
<p><strong>${esc(r.passId)}</strong></p>
<h2>Open your pass</h2>
<p><a href="${url}"><strong>${url}</strong></a></p>
<p>Your track is ${esc(trackName(r.homeTrack))}. Sessions for it are announced closer to the day, and you will get an email the moment you can choose yours.</p>
<h2>When and where</h2>
<p>${esc(event.dateLabel)}, doors ${doors} IST<br>${esc(venue.name)}<br><a href="${venue.directionsUrl}">Open in Google Maps</a></p>
${footerHtml}`,
  }
}

/** EMAIL 3, on session release, to every VERIFIED attendee, once each. */
export function sessionsLive(r: Person): Body {
  const url = passLink(r.passId)
  return {
    subject: SUBJECTS.sessionsLive,
    text: `Hi ${firstName(r.name)},

Sessions are now live. Open your pass and choose one for each slot.

CHOOSE YOUR SESSIONS
${url}

Seats are limited per room and your choices are final once saved, so pick the ones you actually want to sit in.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>Sessions are now live. Open your pass and choose one for each slot.</p>
<h2>Choose your sessions</h2>
<p><a href="${url}"><strong>${url}</strong></a></p>
<p>Seats are limited per room and your choices are final once saved, so pick the ones you actually want to sit in.</p>
${footerHtml}`,
  }
}

export type ChosenSession = { slot: Slot; session: Session }

const describe = (c: ChosenSession) =>
  `${c.slot.label}${slotTime(c.slot) ? `, ${slotTime(c.slot)}` : ''}: ${c.session.title ?? `${trackName(c.session.track)} session`}, ${roomById(c.session.roomId)?.name ?? 'room announced soon'}`

/** EMAIL 4, on entering SESSIONS_SELECTED. */
export function passReady(r: Person, chosen: ChosenSession[]): Body {
  const url = passLink(r.passId)
  return {
    subject: SUBJECTS.passReady,
    text: `Hi ${firstName(r.name)},

Your pass is ready. Show the QR on it at the gate.

YOUR PASS
${url}

YOUR SESSIONS
${chosen.map((c) => `- ${describe(c)}`).join('\n')}

Doors ${doors} IST on ${event.dateLabel}, ${venue.name}. Need a change? Reply to this email.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>Your pass is ready. Show the QR on it at the gate.</p>
<h2>Your pass</h2>
<p><a href="${url}"><strong>${url}</strong></a></p>
<h2>Your sessions</h2>
<ul>${chosen.map((c) => `<li>${esc(describe(c))}</li>`).join('')}</ul>
<p>Doors ${doors} IST on ${esc(event.dateLabel)}, ${esc(venue.name)}. Need a change? Reply to this email.</p>
${footerHtml}`,
  }
}

/** REJECTION EMAIL, on entering REJECTED. Quotes the UTR, links the resubmission form, never the pass. */
export function rejection(r: Person, utr: string, reason: string): Body {
  const url = payLink(r.passId)
  return {
    subject: SUBJECTS.rejection,
    text: `Hi ${firstName(r.name)},

We could not match a payment to your registration for ${event.name}.

The UTR you submitted was ${utr}.
${reason ? `Note from the organisers: ${reason}\n` : ''}
Please check the UTR in your UPI app and submit the correct one here:
${url}

Or reply to this email with the correct UTR and a screenshot, quoting your pass ID ${r.passId}.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>We could not match a payment to your registration for ${esc(event.name)}.</p>
<p>The UTR you submitted was <strong>${esc(utr)}</strong>.</p>
${reason ? `<p>Note from the organisers: ${esc(reason)}</p>` : ''}
<p>Please check the UTR in your UPI app and <a href="${url}">submit the correct one here</a>.</p>
<p>Or reply to this email with the correct UTR and a screenshot, quoting your pass ID <strong>${esc(r.passId)}</strong>.</p>
${footerHtml}`,
  }
}

/** Sent the day before with timings and directions. */
export function dayBefore(r: Person): Body {
  const url = passLink(r.passId)
  return {
    subject: SUBJECTS.dayBefore,
    text: `Hi ${firstName(r.name)},

See you tomorrow.

Doors:  ${doors} IST. Come early, the gate queue is the slow part.
Where:  ${venue.name}${venue.address ? `\n        ${venue.address}` : ''}
Map:    ${venue.directionsUrl}

YOUR PASS
${url}

Open it before you arrive so it is loaded, then show the QR at the gate. Your sessions are on the same page.

Lunch is included. If your food preference has changed, reply to this email today.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>See you tomorrow.</p>
<h2>Timings</h2>
<p>Doors <strong>${doors} IST</strong>. Come early, the gate queue is the slow part.</p>
<h2>Getting there</h2>
<p>${esc(venue.name)}${venue.address ? `<br>${esc(venue.address)}` : ''}<br><a href="${venue.directionsUrl}">Open in Google Maps</a></p>
<h2>Your pass</h2>
<p><a href="${url}"><strong>${url}</strong></a></p>
<p>Open it before you arrive so it is loaded, then show the QR at the gate. Your sessions are on the same page.</p>
<p>Lunch is included. If your food preference has changed, reply to this email today.</p>
${footerHtml}`,
  }
}
