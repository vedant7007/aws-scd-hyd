import { event, venue } from '../../content/event'
import { programSession } from '../../content/program'
import { REFUND_POLICY, formatInr, passes, tierLabel } from '../../content/passes'
import type { Attendee } from '../db/types'
import { siteUrl } from '../site'
import type { Mail } from './send'

/**
 * Every body the site sends, in one place, so wording changes here and
 * nowhere else. All transactional, none of them market anything.
 *
 * The HTML wears the site's look: a dark header with the orange stripe,
 * bordered cards, the pass id in large mono type, one real button. It is
 * built the way mail must be: tables, inline styles, system fonts, no
 * scripts, no tracking pixels, and a plain text part that says the same
 * thing. No images at all.
 */

/**
 * How long a student is told verification takes, read into a sentence: "We
 * will check your payment ...". No fixed hours since 3 October 2026, by the
 * organiser's decision. Never promise instant.
 */
export const VERIFICATION_WINDOW = 'as soon as we can'

/**
 * Words email 1 must never contain. Nobody has checked the money when it is
 * sent, and it is the only thing standing between us and fifty people at the
 * gate with a "confirmation" nobody verified. Enforced by the test suite.
 */
export const RECEIPT_FORBIDDEN_WORDS = ['successful', 'success', 'confirmed', 'confirmation', 'paid', 'complete', 'approved', 'verified'] as const

export const SUBJECTS = {
  receipt: `We have your details, ${event.shortName}`,
  confirmation: `Payment verified, ${event.shortName}`,
  rejection: `We could not match your payment, ${event.shortName}`,
  dayBefore: `Tomorrow: ${event.shortName}`,
  registrationsOpen: `Registrations are open: ${event.shortName}`,
  stillVerifying: `We are still checking your payment, ${event.shortName}`,
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

/* ---- the HTML shell ------------------------------------------------------ */

const INK = '#14161C'
const ORANGE = '#FF9900'
const CREAM = '#F5F2EE'
const MUTED = '#5A6070'
const MINT = '#1F6540'
const SANS = "Arial,'Helvetica Neue',Helvetica,sans-serif"
const MONO = "'Courier New',Courier,monospace"

const eyebrow = (t: string, color = MINT) =>
  `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${color}">${t}</p>`
const p = (html: string) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">${html}</p>`
const small = (html: string) => `<p style="margin:0 0 12px;font-family:${SANS};font-size:13px;line-height:1.55;color:${MUTED}">${html}</p>`

/** A bordered card. Mail clients honour table borders where they ignore box-shadow. */
const card = (inner: string, bg = '#FFFFFF', border = INK) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:3px solid ${border};background:${bg}"><tr><td style="padding:16px 18px">${inner}</td></tr></table>`

/** Label and value rows inside a card. */
const rows = (list: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:9px 0;${i ? 'border-top:1px solid #E3DDD4;' : ''}font-family:${MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};vertical-align:top;width:34%">${esc(k)}</td><td style="padding:9px 0 9px 12px;${i ? 'border-top:1px solid #E3DDD4;' : ''}font-family:${SANS};font-size:14px;line-height:1.45;color:${INK};text-align:right">${v}</td></tr>`,
    )
    .join('')}</table>`

/** The pass id, large, the one thing to keep. */
const passIdBlock = (passId: string, note: string) =>
  card(`${eyebrow('Your pass ID', MUTED)}<p style="margin:0 0 8px;font-family:${MONO};font-size:28px;font-weight:bold;letter-spacing:2px;color:${INK}">${esc(passId)}</p>${small(note)}`)

/** The pass's sessions as card rows. Titles contain colons, so they are not split out of sessionLines. */
const sessionRows = (r: Person): [string, string][] => [
  ['Technical', esc(programSession(r.technicalSession)?.title ?? r.technicalSession)],
  ...(r.workshop ? ([['Workshop', esc(programSession(r.workshop)?.title ?? r.workshop)]] as [string, string][]) : []),
]

/** A bulletproof button: a table cell, so Outlook draws it too. */
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td style="background:${ORANGE};border:3px solid ${INK}"><a href="${href}" style="display:inline-block;padding:14px 24px;font-family:${SANS};font-size:16px;font-weight:bold;letter-spacing:1px;color:${INK};text-decoration:none">${label}</a></td></tr></table>`

/**
 * The frame every email sits in. `preheader` is the grey line inbox lists
 * show after the subject; it is hidden in the message itself.
 */
function shell(o: { preheader: string; tag: string; title: string; body: string; tagColor?: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${CREAM}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border:3px solid ${INK}">
<tr><td style="background:${INK};padding:18px 22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${MONO};font-size:20px;font-weight:bold;letter-spacing:1px;color:#FFFFFF">SCD<span style="color:${ORANGE}">.</span>HYD<span style="color:#9FE3B6">26</span></td>
<td align="right" style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:#9FE3B6">30.10.2026</td>
</tr></table></td></tr>
<tr><td style="background:${ORANGE};height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:26px 22px 8px">
<p style="margin:0 0 14px"><span style="display:inline-block;padding:5px 10px;border:2px solid ${INK};background:${o.tagColor ?? '#E6F5EB'};font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${INK}">${esc(o.tag)}</span></p>
<h1 style="margin:0 0 18px;font-family:${SANS};font-size:26px;line-height:1.15;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;color:${INK}">${esc(o.title)}</h1>
${o.body}
</td></tr>
<tr><td style="padding:16px 22px 22px;border-top:3px solid #E3DDD4;background:${CREAM}">
<p style="margin:0 0 6px;font-family:${SANS};font-size:12.5px;line-height:1.55;color:${MUTED}">${esc(event.name)} &middot; ${esc(event.dateLabel)} &middot; ${esc(venue.name)}</p>
<p style="margin:0 0 6px;font-family:${SANS};font-size:12.5px;line-height:1.55;color:${MUTED}">${esc(event.host)}. Questions? Just reply, it reaches ${esc(REPLY_TO)}.</p>
<p style="margin:0;font-family:${SANS};font-size:11.5px;line-height:1.55;color:${MUTED}">${esc(event.disclaimer)}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

type Person = Pick<Attendee, 'name' | 'passId' | 'tier' | 'technicalSession' | 'workshop' | 'amountPaise'>

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
    text: `Hi ${r.name},

We have your details and your UTR for ${event.name}.

We will check your payment against the college bank statement ${VERIFICATION_WINDOW}, and email you when it is verified. Until then there is nothing you need to do.

YOUR PASS ID
${r.passId}

Keep it safe. It is how we find your registration.

YOUR PASS
${tierLabel(r.tier)}, ${formatInr(r.amountPaise)}
${lines.join('\n')}

If you have a question, reply to this email. Replies go to ${REPLY_TO}.

${footerText}`,
    html: shell({
      preheader: `Pass ID ${r.passId}. We will check your payment ${VERIFICATION_WINDOW}.`,
      tag: 'Received · being checked',
      tagColor: '#FDF4E3',
      title: `We have your details, ${r.name}`,
      body: [
        p(`We have your registration and your UTR for <strong>${esc(event.name)}</strong>.`),
        p(`A person on our team matches every UTR against the college bank statement. We will do yours <strong>${VERIFICATION_WINDOW}</strong>, then email you when it is verified. Until then there is nothing you need to do.`),
        passIdBlock(r.passId, 'Keep it safe. It is how we find your registration.'),
        card(`${eyebrow('Your pass')}${rows([['Pass', esc(tierLabel(r.tier))], ['Amount', esc(formatInr(r.amountPaise))], ...sessionRows(r)])}`),
        small('Sessions are subject to change. If yours does, we will email you.'),
      ].join('\n'),
    }),
  }
}

/** EMAIL 2, on entering VERIFIED: the payment is verified. No ticket yet, by the organiser's decision (29 September 2026). */
export function confirmation(r: Person): Body {
  const lines = sessionLines(r)
  return {
    subject: SUBJECTS.confirmation,
    text: `Hi ${r.name},

Your payment for ${event.name} is verified. Your ${tierLabel(r.tier)} registration is complete.

YOUR PASS ID
${r.passId}

Keep it safe. It is how we find your registration.

YOUR PASS
${tierLabel(r.tier)}, ${formatInr(r.amountPaise)}
${lines.join('\n')}
Sessions are subject to change. If yours does, we will email you.

When:  ${event.dateLabel}, doors ${doors} IST
Where: ${venue.name}
Map:   ${venue.directionsUrl}

We will email you again before the event with everything you need at the gate.

REFUNDS
${REFUND_POLICY}

${footerText}`,
    html: shell({
      preheader: `Your payment is verified. Pass ID ${r.passId}.`,
      tag: 'Payment verified',
      title: `Payment verified, ${r.name}`,
      body: [
        p(`Your payment for <strong>${esc(event.name)}</strong> is verified. Your <strong>${esc(tierLabel(r.tier))}</strong> registration is complete.`),
        passIdBlock(r.passId, 'Keep it safe. It is how we find your registration.'),
        card(`${eyebrow('Your pass')}${rows([['Pass', esc(tierLabel(r.tier))], ['Amount', esc(formatInr(r.amountPaise))], ...sessionRows(r)])}`),
        small('Sessions are subject to change. If yours does, we will email you.'),
        card(
          `${eyebrow('When and where')}${rows([
            ['Date', esc(event.dateLabel)],
            ['Doors', `${esc(doors)} IST`],
            ['Venue', esc(venue.name)],
            ['Map', `<a href="${venue.directionsUrl}" style="color:${MINT};font-weight:bold">Open in Google Maps</a>`],
            ['Lunch', 'Included'],
          ])}`,
          '#E6F5EB',
        ),
        p('We will email you again before the event with everything you need at the gate.'),
        card(`${eyebrow('Refunds', MUTED)}${small(esc(REFUND_POLICY))}`, CREAM, '#E3DDD4'),
      ].join('\n'),
    }),
  }
}

/**
 * A one-off note to registrations waiting on verification, sent by hand when
 * checking runs late (3 October 2026): we have it, sorry for the wait, nothing
 * to do.
 */
export function stillVerifying(r: Person): Body {
  return {
    subject: SUBJECTS.stillVerifying,
    text: `Hi ${r.name},

Thank you for registering for ${event.name}, and sorry for the wait.

Your registration and payment details reached us safely. We are checking every payment against the college bank statement by hand, and it is taking us a little longer than we hoped. Yours is in the queue and we will email you as soon as it is verified.

There is nothing you need to do. Please do not pay again. Sit back and relax; your seat is held while we check.

YOUR PASS ID
${r.passId}

If you have a question, reply to this email. Replies go to ${REPLY_TO}.

${footerText}`,
    html: shell({
      preheader: `Pass ID ${r.passId}. Your payment is in the queue, nothing for you to do.`,
      tag: 'Still checking',
      tagColor: '#FDF4E3',
      title: `Sorry for the wait, ${r.name}`,
      body: [
        p(`Thank you for registering for <strong>${esc(event.name)}</strong>, and sorry for the wait.`),
        p('Your registration and payment details reached us safely. We are checking every payment against the college bank statement by hand, and it is taking us a little longer than we hoped. Yours is in the queue and we will email you as soon as it is verified.'),
        p('There is <strong>nothing you need to do</strong>. Please do not pay again. Sit back and relax; your seat is held while we check.'),
        passIdBlock(r.passId, 'Keep it safe. It is how we find your registration.'),
      ].join('\n'),
    }),
  }
}

/** REJECTION EMAIL, on entering REJECTED. Quotes the UTR, links the resubmission page, never the ticket. */
export function rejection(r: Person, utr: string, reason: string): Body {
  const url = payLink(r.passId)
  return {
    subject: SUBJECTS.rejection,
    text: `Hi ${r.name},

We could not match a payment to your registration for ${event.name}.

The UTR you submitted was ${utr}.
${reason ? `Note from the organisers: ${reason}\n` : ''}
Your sessions are still held. Check the UTR in your UPI app and submit the correct one here:
${url}

Or reply to this email with the correct UTR and a screenshot, quoting your pass ID ${r.passId}.

${footerText}`,
    html: shell({
      preheader: `The UTR ${utr} did not match. Your sessions are still held; send the right one.`,
      tag: 'Action needed',
      tagColor: '#FFE1DF',
      title: `We could not match your payment`,
      body: [
        p(`Hi ${esc(r.name)}, we could not match a payment to your registration for ${esc(event.name)}.`),
        card(`${eyebrow('What we checked', '#A3231F')}${rows([['UTR', `<span style="font-family:${MONO}">${esc(utr)}</span>`], ['Pass ID', `<span style="font-family:${MONO}">${esc(r.passId)}</span>`], ...(reason ? ([['Note', esc(reason)]] as [string, string][]) : [])])}`, '#FFFFFF', '#A3231F'),
        p('Your sessions are still held. Check the UTR in your UPI app and send the correct one with a screenshot. If you have already paid, do not pay again.'),
        button(url, 'SEND THE CORRECT UTR &rarr;'),
        small(`Or reply to this email with the correct UTR and a screenshot, quoting your pass ID ${esc(r.passId)}.`),
      ].join('\n'),
    }),
  }
}

/** Sent the day before with timings and directions. */
export function dayBefore(r: Person): Body {
  const url = passLink(r.passId)
  return {
    subject: SUBJECTS.dayBefore,
    text: `Hi ${r.name},

See you tomorrow.

Doors:  ${doors} IST. Come early, the gate queue is the slow part.
Where:  ${venue.name}${venue.address ? `\n        ${venue.address}` : ''}
Map:    ${venue.directionsUrl}

YOUR TICKET
${url}

Open it before you arrive so it is loaded, then show the QR at the gate.

Lunch is included.

${footerText}`,
    html: shell({
      preheader: `Doors at ${doors} IST tomorrow. Bring your ticket QR.`,
      tag: 'Tomorrow',
      title: `See you tomorrow, ${r.name}`,
      body: [
        card(
          `${eyebrow('The day')}${rows([
            ['Doors', `${esc(doors)} IST`],
            ['Venue', `${esc(venue.name)}${venue.address ? `<br>${esc(venue.address)}` : ''}`],
            ['Map', `<a href="${venue.directionsUrl}" style="color:${MINT};font-weight:bold">Open in Google Maps</a>`],
            ['Lunch', 'Included'],
          ])}`,
          '#E6F5EB',
        ),
        p('Come early, the gate queue is the slow part. Open your ticket before you arrive so it is loaded, then show the QR at the gate.'),
        button(url, 'OPEN MY TICKET &rarr;'),
      ].join('\n'),
    }),
  }
}

/** To the notify list, once, when registration opens. They asked for exactly this and nothing else. */
export function registrationsOpen(): Body {
  const url = link('/register')
  return {
    subject: SUBJECTS.registrationsOpen,
    text: `Hi,

You asked us to tell you when registrations open for ${event.name}. They are open now.

Register here:
${url}

When:  ${event.dateLabel}, doors ${doors} IST
Where: ${venue.name}

Passes start at ${formatInr(Math.min(...passes.map((x) => x.pricePaise ?? Infinity)))}, and lunch is on every pass. Seats in each session are limited, so pick yours early.

You are getting this one email because you left your address on our registration page. We will not add you to anything else.

${footerText}`,
    html: shell({
      preheader: `Registrations for ${event.name} are open. Pick your pass and your sessions.`,
      tag: 'Registrations open',
      title: 'Registrations are open',
      body: [
        p(`You asked us to tell you when registrations open for <strong>${esc(event.name)}</strong>. They are open now.`),
        button(url, 'REGISTER NOW &rarr;'),
        card(
          `${eyebrow('The day')}${rows([
            ['Date', esc(event.dateLabel)],
            ['Doors', `${esc(doors)} IST`],
            ['Venue', esc(venue.name)],
            ['Passes', passes.map((x) => `${esc(x.name)} ${x.pricePaise === null ? '' : esc(formatInr(x.pricePaise))}`).join('<br>')],
            ['Lunch', 'On every pass'],
          ])}`,
          '#E6F5EB',
        ),
        p('Seats in each session are limited, so pick yours early.'),
        small('You are getting this one email because you left your address on our registration page. We will not add you to anything else.'),
      ].join('\n'),
    }),
  }
}
