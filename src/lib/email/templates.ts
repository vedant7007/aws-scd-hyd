import { event, venue } from '../../content/event'
import { tierLabel } from '../../content/passes'
import type { Tier } from '../db/types'
import { siteUrl } from '../site'
import type { Mail } from './send'

/**
 * SPEC.md section 12. Three templates, plain and mobile legible.
 *
 * The HTML is deliberately unstyled: no colours, no fonts, no images and no
 * tracking. Mail clients render semantic HTML perfectly well on a phone, and
 * an email with nothing to load is the one that arrives fastest and lands in
 * the inbox rather than promotions. It also means the theme file stays the
 * only place a colour lives.
 */

type Recipient = {
  name: string
  passToken: string
  tier?: Tier
}

type Body = Omit<Mail, 'to'>

/** Provider supplied names go into HTML, so they are escaped. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** Derived from the one startsAt in content, never typed twice. */
const doors = new Date(event.startsAt).toLocaleTimeString('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
})

/**
 * The pass link is the single most important thing in any of these emails, so
 * it refuses to be built against a localhost origin. A student cannot open
 * http://localhost:3000/pass/... from their phone, and one of those going out
 * would be worse than no email at all.
 */
export function passLink(passToken: string): string {
  const origin = siteUrl()
  if (/localhost|127\.0\.0\.1/.test(origin) && process.env.EMAIL_TRANSPORT === 'ses') {
    throw new Error(`Refusing to put a ${origin} pass link in a real email. Set NEXT_PUBLIC_SITE_URL.`)
  }
  return `${origin}/pass/${passToken}`
}

const footerText = `${event.host}\nReplies go to ${process.env.SES_REPLY_TO ?? 'the organisers'}.\n${event.disclaimer}`

const footerHtml = `<hr><p>${esc(event.host)}<br>${esc(event.disclaimer)}</p>`

/** Ticket confirmation, sent once on creation. SPEC.md section 8 step 4. */
export function confirmation(r: Recipient): Body {
  const link = passLink(r.passToken)
  const tier = r.tier ? `${tierLabel(r.tier)} pass` : 'pass'

  return {
    subject: `Your ${event.shortName} pass`,
    text: `Hi ${firstName(r.name)},

You are in. This is your ${tier} for ${event.name}.

YOUR PASS LINK
${link}

Keep this link. It is your ticket at the gate and where you pick your sessions. There is no login, the link is the whole thing.

When:  ${event.dateLabel}, doors ${doors} IST
Where: ${venue.name}${venue.address ? `\n       ${venue.address}` : ''}
Map:   ${venue.directionsUrl}

What to bring
- This link, on your phone. The QR on it gets you through the gate.
- A college ID, in case we need to check a name.
- A charged phone. The pass works offline once it has loaded, but it has to load.

Next step: open your pass and pick one session per slot. Halls fill up, so do it early.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>You are in. This is your <strong>${esc(tier)}</strong> for ${esc(event.name)}.</p>
<h2>Your pass link</h2>
<p><a href="${link}"><strong>${link}</strong></a></p>
<p>Keep this link. It is your ticket at the gate and where you pick your sessions. There is no login, the link is the whole thing.</p>
<h2>When and where</h2>
<p>${esc(event.dateLabel)}, doors ${doors} IST<br>
${esc(venue.name)}${venue.address ? `<br>${esc(venue.address)}` : ''}<br>
<a href="${venue.directionsUrl}">Open in Google Maps</a></p>
<h2>What to bring</h2>
<ul>
<li>This link, on your phone. The QR on it gets you through the gate.</li>
<li>A college ID, in case we need to check a name.</li>
<li>A charged phone. The pass works offline once it has loaded, but it has to load.</li>
</ul>
<p><strong>Next step:</strong> open your pass and pick one session per slot. Halls fill up, so do it early.</p>
${footerHtml}`,
  }
}

/** Sent a week out to anyone who has not picked sessions. */
export function sessionReminder(r: Recipient): Body {
  const link = passLink(r.passToken)

  return {
    subject: `Pick your sessions for ${event.shortName}`,
    text: `Hi ${firstName(r.name)},

${event.name} is a week away and you have not picked your sessions yet.

Three tracks run at the same time, one session per slot, and the halls are not the same size. Once a hall is full it is full.

PICK YOUR SESSIONS
${link}

It takes about a minute. The same link is your ticket on the day.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>${esc(event.name)} is a week away and you have not picked your sessions yet.</p>
<p>Three tracks run at the same time, one session per slot, and the halls are not the same size. Once a hall is full it is full.</p>
<h2>Pick your sessions</h2>
<p><a href="${link}"><strong>${link}</strong></a></p>
<p>It takes about a minute. The same link is your ticket on the day.</p>
${footerHtml}`,
  }
}

/** Sent the day before with timings and directions. */
export function dayBefore(r: Recipient): Body {
  const link = passLink(r.passToken)

  return {
    subject: `Tomorrow: ${event.shortName}`,
    text: `Hi ${firstName(r.name)},

See you tomorrow.

Doors:  ${doors} IST. Come early, the gate queue is the slow part.
Where:  ${venue.name}${venue.address ? `\n        ${venue.address}` : ''}
Map:    ${venue.directionsUrl}

YOUR PASS
${link}

Open it before you arrive so it is loaded, then show the QR at the gate. Your session picks are on the same page.

Lunch is included. If your food preference has changed, reply to this email today.

${footerText}`,
    html: `<p>Hi ${esc(firstName(r.name))},</p>
<p>See you tomorrow.</p>
<h2>Timings</h2>
<p>Doors <strong>${doors} IST</strong>. Come early, the gate queue is the slow part.</p>
<h2>Getting there</h2>
<p>${esc(venue.name)}${venue.address ? `<br>${esc(venue.address)}` : ''}<br>
<a href="${venue.directionsUrl}">Open in Google Maps</a></p>
<h2>Your pass</h2>
<p><a href="${link}"><strong>${link}</strong></a></p>
<p>Open it before you arrive so it is loaded, then show the QR at the gate. Your session picks are on the same page.</p>
<p>Lunch is included. If your food preference has changed, reply to this email today.</p>
${footerHtml}`,
  }
}
