import { randomInt } from 'node:crypto'
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './db/client'
import { PASS_ALPHABET, normaliseEmail, normalisePassId } from './db/keys'
import { isReservedAddress, sendEmail } from './email/send'
import { REPLY_TO } from './email/templates'
import { MEALS, REPORT_KINDS, SPEAK_FORMATS, SPONSOR_KINDS } from './forms-options'

/**
 * The three forms the v3 handoff draws with no backend behind them: apply
 * to speak, sponsor enquiry, and the code of conduct report. Each is checked
 * here, stored as one item under FORM#<kind> (newest last by SK), and mailed
 * to the organisers' inbox with Reply-To set to the sender, so answering is
 * one click. Nothing is ever mailed to the sender: the form must not be a way
 * to send mail to an address someone typed.
 */

export const FORM_KINDS = ['speak', 'sponsor', 'report'] as const
export type FormKind = (typeof FORM_KINDS)[number]

export type Submission = {
  PK: string
  SK: string
  kind: FormKind
  ref: string
  createdAt: string
  email: string
  /** Every other answer, already checked and trimmed. Labels are the handoff's own. */
  fields: Record<string, string>
  urgent?: boolean
}

export type Invalid = { field: string; message: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const label = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id

/** A reference like SCD-SPK-7KQ2M, from the pass id alphabet: nothing to misread on a phone call. */
function newRef(kind: FormKind, urgent: boolean): string {
  const prefix = kind === 'speak' ? 'SPK' : kind === 'sponsor' ? 'SPN' : urgent ? 'URG' : 'RPT'
  let out = ''
  for (let i = 0; i < 5; i++) out += PASS_ALPHABET[randomInt(PASS_ALPHABET.length)]
  return `SCD-${prefix}-${out}`
}

type Checked = { email: string; fields: Record<string, string>; urgent?: boolean }

/** The handoff's rules and messages, enforced on the server. */
export function validateForm(kind: FormKind, b: Record<string, unknown>): Checked | { error: Invalid } {
  const str = (k: string, max = 160) => (typeof b[k] === 'string' ? (b[k] as string).trim().replace(/[ \t]+/g, ' ').slice(0, max) : '')
  const long = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, 4000) : '')
  const email = str('email', 254)
  const phoneOk = () => str('phone', 20).replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '')

  if (kind === 'report') {
    const about = str('about')
    if (!REPORT_KINDS.some((k) => k.id === about)) return { error: { field: 'kind', message: 'Pick what this is about.' } }
    if (!email) return { error: { field: 'email', message: 'We need an email to reply to.' } }
    if (!EMAIL.test(email)) return { error: { field: 'email', message: 'That does not look like a working email.' } }
    const detail = long('detail')
    if (!detail) return { error: { field: 'detail', message: 'Tell us what happened.' } }
    if (detail.length < 20) return { error: { field: 'detail', message: 'A bit more detail helps us act on it.' } }
    const code = str('passId', 40)
    return {
      email: normaliseEmail(email),
      urgent: b.urgent === true,
      fields: { about: label(REPORT_KINDS, about), name: str('name', 120), passId: code ? (normalisePassId(code) ?? code.toUpperCase()) : '', detail },
    }
  }

  const sponsor = kind === 'sponsor'
  const org = str('org')
  if (sponsor && !org) return { error: { field: 'org', message: 'Who is sponsoring?' } }
  const name = str('name', 120)
  if (!name) return { error: { field: 'name', message: 'We need a name.' } }
  if (!email) return { error: { field: 'email', message: 'We need an email to reply to.' } }
  if (!EMAIL.test(email)) return { error: { field: 'email', message: 'That does not look like a working email.' } }
  const phone = phoneOk()
  if (phone.length !== 10) return { error: { field: 'phone', message: 'Enter exactly 10 digits, no +91.' } }

  const fields: Record<string, string> = { name, role: str('role', 120), phone: `+91${phone}` }

  if (sponsor) {
    const picked = Array.isArray(b.kinds) ? SPONSOR_KINDS.filter((k) => (b.kinds as unknown[]).includes(k.id)) : []
    if (!picked.length) return { error: { field: 'kinds', message: 'Pick at least one.' } }
    const other = str('other')
    if (picked.some((k) => k.id === 'other') && !other) return { error: { field: 'kinds', message: 'Tell us what else you want to sponsor.' } }
    const offer = long('offer')
    if (!offer) return { error: { field: 'offer', message: 'Tell us what you can put in.' } }
    if (offer.length < 25) return { error: { field: 'offer', message: 'A bit more detail, this is what we plan around.' } }
    Object.assign(fields, {
      org,
      site: str('site', 300),
      sponsoring: picked.map((k) => (k.id === 'other' ? other : k.label)).join(' · '),
      offer,
    })
  } else {
    const format = str('format')
    if (!SPEAK_FORMATS.some((f) => f.id === format)) return { error: { field: 'format', message: 'Pick a format.' } }
    fields.format = label(SPEAK_FORMATS, format)
  }

  const topic = str('topic', 200)
  if (!topic) return { error: { field: 'topic', message: sponsor ? 'Give it a working title.' : 'Your talk needs a title.' } }
  const detail = long('detail')
  if (!detail) return { error: { field: 'detail', message: 'Tell us a bit more.' } }
  if (detail.length < 30) return { error: { field: 'detail', message: 'A few more lines, please, this is what we judge it on.' } }
  const meal = str('meal')
  if (!MEALS.some((m) => m.id === meal) || (!sponsor && meal === 'mixed')) return { error: { field: 'meal', message: 'Pick a meal preference.' } }
  Object.assign(fields, { topic, detail, meal: label(MEALS, meal) })

  return { email: normaliseEmail(email), fields }
}

const TITLES: Record<FormKind, string> = { speak: 'Speaker application', sponsor: 'Sponsor enquiry', report: 'Report' }
const LABELS: Record<string, string> = {
  org: 'Organisation',
  site: 'Website',
  name: 'Name',
  role: 'Role',
  phone: 'Phone',
  format: 'Format',
  sponsoring: 'Sponsoring',
  offer: 'Can put in',
  topic: 'Title',
  detail: 'Detail',
  meal: 'Meal',
  about: 'About',
  passId: 'Pass ID',
}
export const fieldLabel = (k: string) => LABELS[k] ?? k

/** Stores the submission, then tells the organisers. A failed mail never loses the submission: the admin inbox has it. */
export async function submitForm(kind: FormKind, checked: Checked): Promise<Submission> {
  const createdAt = new Date().toISOString()
  const ref = newRef(kind, Boolean(checked.urgent))
  const item: Submission = { PK: `FORM#${kind}`, SK: `${createdAt}#${ref}`, kind, ref, createdAt, email: checked.email, fields: checked.fields, ...(kind === 'report' ? { urgent: Boolean(checked.urgent) } : {}) }
  await ddb.send(new PutCommand({ TableName: tableName(), Item: item }))

  const headline = kind === 'speak' ? checked.fields.topic : kind === 'sponsor' ? checked.fields.org : checked.fields.about
  const subject = `${checked.urgent ? 'URGENT ' : ''}${TITLES[kind]} ${ref}: ${headline}`
  const lines = [`${TITLES[kind]} ${ref}${checked.urgent ? ', marked URGENT: happening right now' : ''}`, '', `Email: ${checked.email}`, ...Object.entries(checked.fields).filter(([, v]) => v).map(([k, v]) => `${fieldLabel(k)}: ${v}`), '', 'Reply to this email to answer them directly. Every submission is also on /admin/inbox.']
  const text = lines.join('\n')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${esc(text)}</pre>`
  try {
    // The sender's address as Reply-To, unless it is a reserved test one.
    await sendEmail({ to: REPLY_TO, subject, text, html, ...(isReservedAddress(checked.email) ? {} : { replyTo: checked.email }) })
  } catch (err) {
    console.error(`[forms] organiser mail for ${ref} failed; it is still in the inbox`, err)
  }
  return item
}

export async function listForms(kind: FormKind): Promise<Submission[]> {
  const res = await ddb.send(
    new QueryCommand({ TableName: tableName(), KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': `FORM#${kind}` }, ScanIndexForward: false, Limit: 300 }),
  )
  return (res.Items ?? []) as Submission[]
}
