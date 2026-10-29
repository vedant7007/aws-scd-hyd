import { BUILDER_SIGNUP, BUILDER_STEPS } from '../../content/builder'
import { event, venue } from '../../content/event'
import { ALONGSIDE, SCHEDULE, SCHEDULE_CAVEAT, VENUE_TBA, WORKSHOP_SLOT, clock } from '../../content/schedule'
import { hasWorkshop, programSession } from '../../content/program'
import { formatInr, passes, tierLabel } from '../../content/passes'
import { REFERRAL_CUTOFF_LABEL, referralOpen } from '../../content/referral'
import type { Attendee } from '../db/types'
import { siteUrl } from '../site'
import { TRANSPORT_PDF } from '../../content/transport'
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
  confirmation: `You're in! Payment verified, ${event.shortName}`,
  rejection: `We could not match your payment, ${event.shortName}`,
  dayBefore: `Today: your schedule and what to bring, ${event.shortName}`,
  ticket: `Your ticket: ${event.shortName}`,
  registrationsOpen: `Registrations are open: ${event.shortName}`,
  stillVerifying: `We are still checking your payment, ${event.shortName}`,
  builderId: `Action needed: add your AWS Builder ID, ${event.shortName}`,
  referral: `A quick update on your registration: ${event.shortName}`,
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

/** Who else is in a group, for its mails. Absent outside a group. */
export type GroupNote = { leaderName: string; size: number; isLeader: boolean; totalPaise: number; members: { name: string; passId: string }[] }

function groupText(g: GroupNote): string {
  const list = g.members.map((m) => `- ${m.name}: ${m.passId}`).join('\n')
  return g.isLeader
    ? `YOUR GROUP OF ${g.size}\nYou registered everyone and sent one payment for the group, ${formatInr(g.totalPaise)} in all. Each person has their own pass ID and gets their own emails:\n${list}\n\n`
    : `YOUR GROUP\n${g.leaderName} registered you in a group of ${g.size} and covers the payment for everyone. There is nothing for you to pay.\n\n`
}

function groupHtml(g: GroupNote): string {
  return g.isLeader
    ? card(
        `${eyebrow(`Your group of ${g.size}`)}${small(`You registered everyone and sent one payment for the group, <strong>${esc(formatInr(g.totalPaise))}</strong> in all. Each person has their own pass ID and gets their own emails.`)}${rows(g.members.map((m) => [m.name, `<span style="font-family:${MONO}">${esc(m.passId)}</span>`]))}`,
        '#E6F5EB',
      )
    : card(`${eyebrow('Your group')}${small(`<strong>${esc(g.leaderName)}</strong> registered you in a group of ${g.size} and covers the payment for everyone. There is nothing for you to pay.`)}`, '#E6F5EB')
}

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
export function receipt(r: Person, g?: GroupNote): Body {
  const lines = sessionLines(r)
  return {
    subject: SUBJECTS.receipt,
    text: `Hi ${r.name},

We have your details and your UTR for ${event.name}.

We will check your payment against the college bank statement ${VERIFICATION_WINDOW}, and email you once we have checked it. Until then there is nothing you need to do.

YOUR PASS ID
${r.passId}

Keep it safe. It is how we find your registration.

${g ? groupText(g) : ''}YOUR PASS
${tierLabel(r.tier)}, ${formatInr(r.amountPaise)}
${lines.join('\n')}

BRING YOUR FRIENDS
${referText}
${referLink(r.passId)}

If you have a question, reply to this email. Replies go to ${REPLY_TO}.

${footerText}`,
    html: shell({
      preheader: `Pass ID ${r.passId}. We will check your payment ${VERIFICATION_WINDOW}.`,
      tag: 'Received · being checked',
      tagColor: '#FDF4E3',
      title: `We have your details, ${r.name}`,
      body: [
        p(`We have your registration and your UTR for <strong>${esc(event.name)}</strong>.`),
        p(`A person on our team matches every UTR against the college bank statement. We will do yours <strong>${VERIFICATION_WINDOW}</strong>, then email you once we have checked it. Until then there is nothing you need to do.`),
        passIdBlock(r.passId, 'Keep it safe. It is how we find your registration.'),
        ...(g ? [groupHtml(g)] : []),
        card(`${eyebrow('Your pass')}${rows([['Pass', esc(tierLabel(r.tier))], ['Amount', esc(formatInr(r.amountPaise))], ...sessionRows(r)])}`),
        small('Sessions are subject to change. If yours does, we will email you.'),
        referCard(r.passId),
      ].join('\n'),
    }),
  }
}

/**
 * EMAIL 2, on entering VERIFIED: the payment is verified and the seat is
 * theirs. No ticket yet, by the organisers' decision: it follows on
 * TICKET_DAY_LABEL to the same address. After that day the ticket goes out
 * by hand from admin, so the mail just says it follows shortly.
 */
export function confirmation(r: Person & Partial<Pick<Attendee, 'email' | 'builderId'>>, g?: GroupNote, at = new Date().toISOString()): Body {
  const first = r.name.split(' ')[0]
  const lines = sessionLines(r)
  const ticketDayPassed = at > TICKET_DAY_END
  const when = ticketDayPassed ? 'in a separate email shortly' : `by email on ${TICKET_DAY_LABEL}, two days before the event`
  const to = r.email ? ` at this same address, ${r.email}` : ' at this same email address'
  const ticketNote = `Your ticket with your entry QR will reach you ${when}${to}. Keep an eye on your inbox, and check Spam or Promotions if you do not see it. There is nothing you need to do until then.`
  const steps: { icon: string; title: string; text: string; href: string; label: string; accent: string }[] = [
    ...(r.builderId
      ? []
      : [{ icon: '🆔', title: 'Add your AWS Builder ID', text: 'Needed for every attendee. Your @username is in AWS Builder Center under Manage profile.', href: link(`/builder-id?pass=${encodeURIComponent(r.passId)}`), label: 'ADD MY BUILDER ID &rarr;', accent: '#F6D27A' }]),
    ...(referralOpen(at)
      ? [{ icon: '🏆', title: 'Bring your friends, win prizes', text: esc(referText), href: referLink(r.passId), label: 'GET MY CODE &rarr;', accent: ORANGE }]
      : []),
    { icon: '📸', title: "Tell everyone you're coming", text: "Put your photo in our I'm attending frame and share it on LinkedIn, Instagram or WhatsApp. Tag @awssbg_vjit.", href: link('/attending'), label: 'MAKE MY POST &rarr;', accent: '#9FE3B6' },
    { icon: '📲', title: 'Follow us for updates', text: 'Speaker reveals, session news and day-of updates go up on our Instagram first.', href: INSTAGRAM, label: 'FOLLOW @AWSSBG_VJIT &rarr;', accent: '#C4AEF2' },
  ]
  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:${INK};border:3px solid ${INK}"><tr><td align="center" style="padding:24px 16px 22px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px"><tr><td width="56" height="56" align="center" valign="middle" style="width:56px;height:56px;background:#9FE3B6;border:3px solid #FFFFFF;font-family:${SANS};font-size:30px;font-weight:bold;line-height:56px;color:${INK}">&#10003;</td></tr></table>
<p style="margin:0 0 6px;font-family:${MONO};font-size:11px;letter-spacing:3px;color:#9FE3B6">PAYMENT VERIFIED &middot; SEAT CONFIRMED</p>
<p style="margin:0 0 10px;font-family:${MONO};font-size:28px;font-weight:bold;letter-spacing:2px;color:${ORANGE}">YOU&rsquo;RE IN!</p>
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.55;color:#E8F2EC">See you on ${esc(event.dateLabel)} at ${esc(venue.name)}.</p>
</td></tr></table>`
  const tracker = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:3px solid ${INK};background:#FFFFFF"><tr><td style="padding:16px 8px 14px">
<p style="margin:0 0 14px;text-align:center;font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">Where your registration is</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${trackStep('✓', 'Registered', 'We have your details', 'done')}
${trackStep('✓', 'Verified', 'Your seat is confirmed', 'done')}
${trackStep('🎟', 'Ticket', ticketDayPassed ? 'Coming shortly' : `Arrives ${TICKET_DAY_LABEL}`, 'now')}
</tr></table></td></tr></table>`

  return {
    subject: SUBJECTS.confirmation,
    text: `Hi ${r.name},

YOU'RE IN!
Your payment for ${event.name} is verified and your seat is confirmed. Thank you for registering.

WHERE YOUR REGISTRATION IS
1. Registered: done
2. Payment verified: done
3. Ticket: ${ticketDayPassed ? 'coming shortly' : `arrives ${TICKET_DAY_LABEL}`}

YOUR TICKET
${ticketNote}

YOUR PASS ID
${r.passId}
Keep it safe. It is how we find your registration.

${g ? groupText(g) : ''}YOUR PASS
${tierLabel(r.tier)}, ${formatInr(r.amountPaise)}
${lines.join('\n')}
Sessions are subject to change. If yours does, we will email you.

WHEN AND WHERE
Date:  ${event.dateLabel}
Doors: ${doors} IST
Venue: ${venue.name}${venue.address ? `\n       ${venue.address}` : ''}
Map:   ${venue.directionsUrl}
Lunch is included.

BEFORE THE EVENT
${steps.map((x, i) => `${i + 1}. ${x.title.toUpperCase()}\n${x.text.replace(/&[a-z]+;/g, '')}\n${x.href}`).join('\n\n')}

${footerText}`,
    html: shell({
      preheader: `You're in! Payment verified, pass ID ${r.passId}. Your ticket arrives ${ticketDayPassed ? 'shortly' : `on ${TICKET_DAY_LABEL}`}.`,
      tag: 'Payment verified',
      title: `You're in, ${first}!`,
      body: [
        hero,
        p(`Your payment for <strong>${esc(event.name)}</strong> is verified and your <strong>${esc(tierLabel(r.tier))}</strong> seat is confirmed. Thank you for registering, we are glad to have you with us.`),
        tracker,
        card(`${eyebrow('🎟 Your ticket', ORANGE)}<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK}">${esc(ticketNote).replace(TICKET_DAY_LABEL, `<strong>${TICKET_DAY_LABEL}</strong>`)}</p>`, '#FFF6E8', ORANGE),
        passIdBlock(r.passId, 'Keep it safe. It is how we find your registration.'),
        ...(g ? [groupHtml(g)] : []),
        card(`${eyebrow('Your pass')}${rows([['Pass', esc(tierLabel(r.tier))], ['Amount', esc(formatInr(r.amountPaise))], ...sessionRows(r)])}`),
        small('Sessions are subject to change. If yours does, we will email you.'),
        card(
          `${eyebrow('When and where')}${rows([
            ['Date', esc(event.dateLabel)],
            ['Doors', `${esc(doors)} IST`],
            ['Venue', `${esc(venue.name)}${venue.address ? `<br><span style="font-size:12.5px;color:${MUTED}">${esc(venue.address)}</span>` : ''}`],
            ['Map', `<a href="${venue.directionsUrl}" style="color:${MINT};font-weight:bold">Open in Google Maps</a>`],
            ['Lunch', 'Included'],
          ])}`,
          '#E6F5EB',
        ),
        `<p style="margin:8px 0 12px;font-family:${MONO};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${INK}">Before the event</p>`,
        ...steps.map((x, i) => updateCard(i + 1, x.icon, x.title, x.text, x.href, x.label, x.accent)),
        p(`See you on the 30th, ${esc(first)}!`),
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

/**
 * To every registration made before the flow asked for a Builder ID
 * (7 October 2026): add it through a personal link, and make the
 * "I'm attending" picture while they are there.
 */
export function builderIdRequest(r: Person): Body {
  const add = link(`/builder-id?pass=${encodeURIComponent(r.passId)}`)
  const post = link('/attending')
  return {
    subject: SUBJECTS.builderId,
    text: `Hi ${r.name},

Thank you for registering for ${event.name}. Two quick things before the day.

1. ADD YOUR AWS BUILDER ID (needed for every attendee)
Add your AWS Builder ID @username to your registration here:
${add}

Your @username is in AWS Builder Center: sign in at builder.aws.com, click your name at the top right, then Manage profile.

No Builder ID yet? Create one free, it takes about two minutes:
${BUILDER_SIGNUP}
${BUILDER_STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n')}

2. TELL EVERYONE YOU'RE COMING
Put your photo in our "I'm attending" frame and share it on LinkedIn, Instagram or WhatsApp:
${post}

YOUR PASS ID
${r.passId}

${footerText}`,
    html: shell({
      preheader: 'Add your AWS Builder ID to your registration, and make your I am attending post.',
      tag: 'Action needed',
      tagColor: '#FDF4E3',
      title: `Two quick things, ${r.name}`,
      body: [
        p(`Thank you for registering for <strong>${esc(event.name)}</strong>. Two quick things before the day.`),
        card(
          `${eyebrow('1 · Add your AWS Builder ID')}${small('Needed for every attendee. Your @username is in AWS Builder Center: sign in at builder.aws.com, click your name at the top right, then <strong>Manage profile</strong>.')}${button(add, 'ADD MY BUILDER ID &rarr;')}${small(`No Builder ID yet? <a href="${BUILDER_SIGNUP}" style="color:${MINT};font-weight:bold">Create one free</a>, it takes about two minutes:`)}<ol style="margin:0 0 4px;padding-left:20px;font-family:${SANS};font-size:13px;line-height:1.55;color:${MUTED}">${BUILDER_STEPS.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
        ),
        card(`${eyebrow('2 · Tell everyone you&rsquo;re coming')}${small('Put your photo in our &ldquo;I&rsquo;m attending&rdquo; frame and share it on LinkedIn, Instagram or WhatsApp.')}${button(post, 'MAKE MY POST &rarr;')}`, '#E6F5EB'),
        passIdBlock(r.passId, 'Keep it safe. It is how we find your registration.'),
      ].join('\n'),
    }),
  }
}

/* ---- referrals ------------------------------------------------------------ */

const referLink = (passId: string) => link(`/refer?pass=${encodeURIComponent(passId)}`)
const referText = `Pick your referral code and share it. Every friend who registers with it is a point on the leaderboard, a group of five is five points, and the top referrers win exciting prizes. Counting ends ${REFERRAL_CUTOFF_LABEL}.`
const referCard = (passId: string) =>
  card(`${eyebrow('Bring your friends · win prizes', ORANGE)}${small(esc(referText))}${button(referLink(passId), 'GET MY REFERRAL CODE &rarr;')}`, '#FFF6E8')

/** When tickets go out, by the organisers' decision (21 October 2026): two days before the event. */
export const TICKET_DAY_LABEL = '28 October'
/** The end of ticket day, IST. Verified after it, the ticket follows by hand from admin. */
const TICKET_DAY_END = '2026-10-28T18:29:59.999Z'
const INSTAGRAM = 'https://www.instagram.com/awssbg_vjit'

/** One step of the status tracker: a filled square when done, an outlined one when not. */
const trackStep = (icon: string, label: string, note: string, state: 'done' | 'now' | 'later') => {
  const bg = state === 'done' ? '#9FE3B6' : state === 'now' ? ORANGE : '#FFFFFF'
  const fg = state === 'later' ? MUTED : INK
  return `<td width="33%" valign="top" align="center" style="padding:0 4px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px"><tr><td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;border:3px solid ${INK};background:${bg};font-size:20px;line-height:44px">${icon}</td></tr></table>
<p style="margin:0 0 2px;font-family:${MONO};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${fg}">${label}</p>
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.4;color:${MUTED}">${note}</p></td>`
}

/** An update: a coloured number column, then the text and one button. */
const updateCard = (n: number, icon: string, title: string, text: string, href: string, label: string, accent: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:3px solid ${INK};background:#FFFFFF"><tr>
<td width="56" valign="top" align="center" style="width:56px;background:${accent};border-right:3px solid ${INK};padding:14px 0">
<p style="margin:0;font-size:22px;line-height:1">${icon}</p>
<p style="margin:6px 0 0;font-family:${MONO};font-size:12px;font-weight:bold;color:${INK}">0${n}</p></td>
<td valign="top" style="padding:14px 16px 4px">
<p style="margin:0 0 6px;font-family:${SANS};font-size:16px;font-weight:bold;color:${INK}">${title}</p>
<p style="margin:0 0 12px;font-family:${SANS};font-size:13.5px;line-height:1.55;color:${MUTED}">${text}</p>
${button(href, label)}</td></tr></table>`

/**
 * The quick update to everyone already registered when referrals opened: a
 * word on the wait and when tickets come, then what is new. Their referral
 * code, who referred them, the Builder ID if it is still missing, and the
 * "I'm attending" post. One mail, not four.
 */
export function referralLaunch(r: Pick<Attendee, 'name' | 'firstName' | 'passId' | 'builderId' | 'state'>): Body {
  const refer = referLink(r.passId)
  const builder = link(`/builder-id?pass=${encodeURIComponent(r.passId)}`)
  const post = link('/attending')
  const board = link('/leaderboard')
  const verified = r.state === 'VERIFIED'
  const wait = verified
    ? `Thank you for your patience. Your payment is verified and your seat is confirmed. Tickets go out on ${TICKET_DAY_LABEL}, two days before the event.`
    : `Sorry for making you wait. Your registration is safe with us. We are verifying payments as fast as we can, and tickets go out on ${TICKET_DAY_LABEL}, two days before the event. For now, sit back and have a look at what is new.`
  const updates: { icon: string; title: string; text: string; href: string; label: string; accent: string }[] = [
    { icon: '🏆', title: 'Get your referral code', text: esc(referText), href: refer, label: 'GET MY CODE &rarr;', accent: ORANGE },
    {
      icon: '🤝',
      title: 'Did someone refer you?',
      text: `If a friend told you about the event, add their code to your registration so they get the credit. Same page, by ${esc(REFERRAL_CUTOFF_LABEL)}.`,
      href: refer,
      label: 'ADD THEIR CODE &rarr;',
      accent: '#C4AEF2',
    },
    ...(r.builderId
      ? []
      : [{ icon: '🆔', title: 'Add your AWS Builder ID', text: 'Needed for every attendee. Your @username is in AWS Builder Center under Manage profile.', href: builder, label: 'ADD MY BUILDER ID &rarr;', accent: '#F6D27A' }]),
    { icon: '📸', title: "Tell everyone you're coming", text: "Put your photo in our I'm attending frame and share it on LinkedIn, Instagram or WhatsApp.", href: post, label: 'MAKE MY POST &rarr;', accent: '#9FE3B6' },
  ]
  const tracker = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:3px solid ${INK};background:#FFFFFF"><tr><td style="padding:16px 8px 14px">
<p style="margin:0 0 14px;text-align:center;font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">Where your registration is</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${trackStep('✓', 'Registered', 'We have your details', 'done')}
${trackStep(verified ? '✓' : '⏳', verified ? 'Verified' : 'Payment check', verified ? 'Your seat is confirmed' : 'In progress, nothing to do', verified ? 'done' : 'now')}
${trackStep('🎟', 'Ticket', `Arrives ${TICKET_DAY_LABEL}`, verified ? 'now' : 'later')}
</tr></table></td></tr></table>`
  const banner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;background:${INK};border:3px solid ${INK}"><tr><td align="center" style="padding:20px 16px">
<p style="margin:0 0 4px;font-family:${MONO};font-size:11px;letter-spacing:3px;color:#F6D27A">&#9679; &#9679; &#9679; LIVE NOW &#9679; &#9679; &#9679;</p>
<p style="margin:0 0 6px;font-family:${MONO};font-size:30px;font-weight:bold;letter-spacing:2px;color:${ORANGE}">HIGH SCORES</p>
<p style="margin:0 0 14px;font-family:${SANS};font-size:13.5px;line-height:1.5;color:#E8F2EC">Top referrers win exciting prizes. Counting ends ${esc(REFERRAL_CUTOFF_LABEL)}.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#9FE3B6;border:3px solid #FFFFFF"><a href="${board}" style="display:inline-block;padding:11px 20px;font-family:${SANS};font-size:14px;font-weight:bold;letter-spacing:1px;color:${INK};text-decoration:none">SEE THE LEADERBOARD &rarr;</a></td></tr></table>
</td></tr></table>`

  return {
    subject: SUBJECTS.referral,
    text: `Hi ${r.name},

A QUICK UPDATE
${wait}

WHERE YOUR REGISTRATION IS
1. Registered: done
2. ${verified ? 'Verified: done' : 'Payment check: in progress, nothing for you to do'}
3. Ticket: arrives ${TICKET_DAY_LABEL}

WHAT'S NEW
${updates.map((x, i) => `${i + 1}. ${x.title.toUpperCase()}\n${x.text.replace(/&[a-z]+;/g, '')}\n${x.href}`).join('\n\n')}

THE LEADERBOARD
Top referrers win exciting prizes. Counting ends ${REFERRAL_CUTOFF_LABEL}.
${board}

YOUR PASS ID
${r.passId}

${footerText}`,
    html: shell({
      preheader: verified ? `Your seat is confirmed. Tickets on ${TICKET_DAY_LABEL}, and the referral leaderboard is live.` : `Sorry for the wait. Your registration is safe with us; tickets go out on ${TICKET_DAY_LABEL}.`,
      tag: 'Quick update',
      tagColor: '#FFF6E8',
      title: `A quick update, ${r.firstName}`,
      body: [
        card(`${eyebrow(verified ? 'Thank you' : 'Thank you for waiting', ORANGE)}<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK}">${esc(wait)}</p>`, '#FFF6E8'),
        tracker,
        `<p style="margin:8px 0 12px;font-family:${MONO};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${INK}">What&rsquo;s new</p>`,
        ...updates.map((x, i) => updateCard(i + 1, x.icon, x.title, x.text, x.href, x.label, x.accent)),
        banner,
        passIdBlock(r.passId, 'You need it for the links above. Keep it safe.'),
      ].join('\n'),
    }),
  }
}

/** The code a volunteer types to sign in. Ten minutes, single use. */
export function volunteerCode(code: string, minutes: number): Body {
  return {
    subject: `${code} is your volunteer sign in code, ${event.shortName}`,
    text: `Your code to sign in as a volunteer for ${event.name} is:\n\n${code}\n\nIt works for ${minutes} minutes. If you did not ask for it, ignore this email.\n\n${footerText}`,
    html: shell({
      preheader: `Your volunteer sign in code. It works for ${minutes} minutes.`,
      tag: 'Volunteer sign in',
      title: 'Your sign in code',
      body: [
        p(`Type this code on the crew sign in page to sign in as a volunteer for <strong>${esc(event.name)}</strong>.`),
        card(`<p style="margin:0;font-family:${MONO};font-size:38px;font-weight:bold;letter-spacing:8px;color:${INK}">${esc(code)}</p>`),
        small(`It works for ${minutes} minutes, once. If you did not ask for it, ignore this email.`),
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

/** The ticket, sent by an admin from the verified list: the pass link with the QR the gate scans. */
/**
 * The ticket card: the ticket image (lib/email/ticket-image.tsx), sent inline
 * with the mail under this content id. An image, not the table QR above, so
 * Gmail's dark mode cannot grey it out.
 */
const ticketCard = (passId: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td align="center">
<img src="cid:ticket-image" width="420" alt="Your ticket, ${esc(passId)}, with the gate QR" style="display:block;width:100%;max-width:420px;height:auto;border:3px solid ${INK}">
</td></tr></table>`

export function ticket(r: Person): Body {
  const url = passLink(r.passId)
  const prefs = `${url}#prefs`
  const bus = link(TRANSPORT_PDF)
  const lines = sessionLines(r)
  return {
    subject: SUBJECTS.ticket,
    text: `Hi ${r.name},

Your ticket for ${event.name} is ready.

OPEN YOUR TICKET
${url}

Show the QR at the gate. Your ticket is attached to this email as a picture; save it to your phone. The same QR is on your ticket page.

TWO QUICK QUESTIONS
Tell us your lunch (veg or non-veg) and whether you are coming by college bus, with your route and stop:
${prefs}

College bus routes and timings (PDF):
${bus}

YOUR PASS ID
${r.passId}

YOUR PASS
${tierLabel(r.tier)}
${lines.join('\n')}

When:  ${event.dateLabel}, doors ${doors} IST
Where: ${venue.name}
Map:   ${venue.directionsUrl}
Lunch is included.

${footerText}`,
    html: shell({
      preheader: `Your ticket is ready. Doors at ${doors} IST on ${event.dateLabel}.`,
      tag: 'Your ticket',
      title: `Your ticket, ${r.name}`,
      body: [
        p(`Your ticket for <strong>${esc(event.name)}</strong> is ready. Show this QR at the gate: a volunteer scans it, writes your name on your ID card and hands over your lunch token.`),
        ticketCard(r.passId),
        button(url, 'OPEN MY TICKET &rarr;'),
        small('The ticket is also attached to this email as a picture: save it to your phone. The same QR is on your ticket page, and the gate can also find you by your pass ID.'),
        card(
          `${eyebrow('Two quick questions', ORANGE)}${p('Tell us your <strong>lunch</strong> (veg or non-veg) and whether you are coming by <strong>college bus</strong>, with your route and stop. It takes ten seconds and helps us plan food and buses.')}${button(prefs, 'CHOOSE FOOD &amp; BUS &rarr;')}${small(`<a href="${bus}" style="color:${MINT};font-weight:bold">College bus routes and timings (PDF)</a>`)}`,
          '#FFF6E8',
        ),
        card(`${eyebrow('Your pass')}${rows([['Pass', esc(tierLabel(r.tier))], ...sessionRows(r)])}`),
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
      ].join('\n'),
    }),
  }
}

/** The AWS sign-up in eight lines, for the day-before email. The attached PDF has the long form. */
const AWS_STEPS = [
  'Go to <strong>aws.amazon.com</strong>, click <strong>Create an AWS Account</strong>',
  'Email, the code from your inbox, a password',
  'Account type <strong>Personal</strong>, your details as on your ID',
  'Pick the <strong>Free plan</strong>',
  'Card check if asked: INR 2, refunded',
  'Phone OTP',
  'Support: <strong>Basic (free)</strong>',
  'Sign in once at console.aws.amazon.com',
]

/**
 * Sent on the morning of the event (named dayBefore from the original plan):
 * the running order with a link to the live schedule page, what to bring and,
 * for the hands-on passes only, the laptop and the AWS account (the sender
 * attaches the PDF guide to those).
 */
export function dayBefore(r: Person): Body {
  const url = passLink(r.passId)
  const scheduleUrl = link('/agenda')
  const howTo = link('/aws-account')
  const handsOn = hasWorkshop(r.tier)
  const workshop = programSession(r.workshop)?.title
  const slot = r.workshop ? WORKSHOP_SLOT[r.workshop] : undefined
  const when = slot ? `${clock(slot.start)} to ${clock(slot.end)}, ${slot.venue ?? VENUE_TBA}` : VENUE_TBA
  const bring = [
    'Your ticket QR (on your phone or printed) and your college ID card',
    ...(handsOn ? ['Your laptop, fully charged, and its charger', 'Your phone, for AWS sign-in codes'] : []),
    'A water bottle',
  ]
  const plan = SCHEDULE.map((s) => `${clock(s.start).padEnd(9)} ${s.title}${s.venue ? ` (${s.venue})` : ''}`).join('\n')
  const planHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${SCHEDULE.map(
    (s, i) =>
      `<tr><td style="padding:7px 10px 7px 0;${i ? 'border-top:1px solid #E3DDD4;' : ''}font-family:${MONO};font-size:12px;font-weight:bold;color:${s.kind === 'workshop' ? '#55359F' : INK};white-space:nowrap;vertical-align:top;width:70px">${clock(s.start)}</td><td style="padding:7px 0;${i ? 'border-top:1px solid #E3DDD4;' : ''}font-family:${SANS};font-size:14px;line-height:1.4;color:${INK}">${s.kind === 'break' ? `<span style="color:${MUTED}">${esc(s.title)}</span>` : `<strong>${esc(s.title)}</strong>`}${s.venue ? `<br><span style="font-family:${MONO};font-size:11px;color:${MINT}">${esc(s.venue)}</span>` : ''}</td></tr>`,
  ).join('')}</table>`
  return {
    subject: SUBJECTS.dayBefore,
    text: `Hi ${r.name},

See you today at ${event.name}.

THE DAY
Date:   ${event.dateLabel}
Doors:  ${doors} IST. Come early, the gate queue is the slow part.
Where:  ${venue.address}
Map:    ${venue.directionsUrl}

SCHEDULE
${plan}
Project Expo runs all afternoon, ${clock(ALONGSIDE.start)} to ${clock(ALONGSIDE.end)}, ${ALONGSIDE.venue}.
${SCHEDULE_CAVEAT}
Full schedule, live on the day: ${scheduleUrl}
${handsOn ? `
YOUR HANDS-ON WORKSHOP: BRING YOUR LAPTOP
${workshop ? `${workshop}\n` : ''}${when}
This is laptop open: you build along with the speaker. Bring your laptop fully charged and its charger. Charging points are limited.

MAKE YOUR AWS ACCOUNT BEFORE YOU LEAVE
You need an AWS account for your workshop. The step by step guide is attached to this email as a PDF (AWS-account-guide.pdf). Sign-up needs an OTP on your phone and sometimes a card check, and campus Wi-Fi with 200 people is the worst place to wait for that.
Watch how (short video): ${howTo}
In short: aws.amazon.com > Create an AWS Account > email and password > Personal > Free plan > card check if asked (INR 2, refunded) > phone OTP > Basic support (free) > sign in once.
` : ''}
BRING
${bring.map((x) => `- ${x}`).join('\n')}

YOUR TICKET
${url}
Open it before you arrive so it is loaded, then show the QR at the gate.

Lunch is included.

${footerText}`,
    html: shell({
      preheader: `Doors at ${doors} IST today. Your schedule${handsOn ? ', your laptop and your AWS account' : ' and what to bring'}.`,
      tag: 'Today',
      title: `See you today, ${r.name}`,
      body: [
        p(`Today is <strong>${esc(event.name)}</strong>. Here is everything you need, in one place.`),
        card(
          `${eyebrow('The day')}${rows([
            ['Date', esc(event.dateLabel)],
            ['Doors', `<strong>${esc(doors)} IST</strong>`],
            ['Venue', esc(venue.address)],
            ['Map', `<a href="${venue.directionsUrl}" style="color:${MINT};font-weight:bold">Open in Google Maps</a>`],
            ['Lunch', 'Included'],
          ])}`,
          '#E6F5EB',
        ),
        card(
          `${eyebrow('Schedule', ORANGE)}${button(scheduleUrl, 'SEE THE FULL SCHEDULE &rarr;')}${planHtml}${small(`<strong>Project Expo</strong> runs all afternoon, ${clock(ALONGSIDE.start)} to ${clock(ALONGSIDE.end)}, ${esc(ALONGSIDE.venue)}.`)}${small(esc(SCHEDULE_CAVEAT))}`,
        ),
        handsOn
          ? card(
              `${eyebrow('Your hands-on workshop', ORANGE)}<p style="margin:0 0 10px;font-family:${SANS};font-size:20px;font-weight:bold;line-height:1.25;color:${INK}">BRING YOUR LAPTOP</p>${workshop ? p(`<strong>${esc(workshop)}</strong><br><span style="font-family:${MONO};font-size:12px;color:${MUTED}">${esc(when)}</span>`) : ''}${p('This is laptop open: you build along with the speaker. Bring your laptop <strong>fully charged</strong> and its <strong>charger</strong>. Charging points are limited.')}`,
              '#FFF6E8',
            )
          : '',
        handsOn
          ? card(
              `${eyebrow('Make your AWS account before you leave', ORANGE)}${p(
                'You need an AWS account for your workshop. The <strong>step by step guide is attached</strong> to this email as a PDF. Sign-up needs an OTP on your phone and sometimes a card check, and campus Wi-Fi with 200 people is the worst place to wait for that.',
              )}${button(howTo, 'WATCH HOW &rarr;')}${AWS_STEPS.map((x, i) => p(`<strong style="font-family:${MONO};color:${ORANGE}">${i + 1}</strong>&nbsp;&nbsp;${x}`)).join('')}${small('Offered sign-up with Google or GitHub? Take it, it usually needs no card. Stuck? Ask a volunteer at the venue.')}`,
            )
          : '',
        card(`${eyebrow('Bring')}${bring.map((x) => p(`&#9632;&nbsp; ${esc(x)}`)).join('')}`),
        p('Open your ticket before you arrive so it is loaded, then show the QR at the gate.'),
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
