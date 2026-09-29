import { randomInt } from 'node:crypto'
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './db/client'
import { PASS_ALPHABET, normaliseEmail, normalisePassId } from './db/keys'
import { isReservedAddress, sendEmail } from './email/send'
import { REPLY_TO } from './email/templates'
import { REPORT_KINDS, SPEAKER_FORM } from './forms-options'

/**
 * The speaker interest form and the code of conduct report. (The sponsor
 * form is parked: /sponsor says coming soon.) Each is checked
 * here, stored as one item under FORM#<kind> (newest last by SK), and mailed
 * to the organisers' inbox with Reply-To set to the sender, so answering is
 * one click. Nothing is ever mailed to the sender: the form must not be a way
 * to send mail to an address someone typed.
 */

export const FORM_KINDS = ['speak', 'report'] as const
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
  const prefix = kind === 'speak' ? 'SPK' : urgent ? 'URG' : 'RPT'
  let out = ''
  for (let i = 0; i < 5; i++) out += PASS_ALPHABET[randomInt(PASS_ALPHABET.length)]
  return `SCD-${prefix}-${out}`
}

type Checked = { email: string; fields: Record<string, string>; urgent?: boolean }

/** Every rule the form shows, enforced again on the server. */
export function validateForm(kind: FormKind, b: Record<string, unknown>): Checked | { error: Invalid } {
  const str = (k: string, max = 160) => (typeof b[k] === 'string' ? (b[k] as string).trim().replace(/[ \t]+/g, ' ').slice(0, max) : '')
  const long = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, 4000) : '')
  const email = str('email', 254)

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

  // The speaker form: every question in SPEAKER_FORM, checked by its kind.
  const fields: Record<string, string> = {}
  for (const q of SPEAKER_FORM.flatMap((sec) => sec.questions)) {
    const need = (message: string) => ({ error: { field: q.id, message } })
    if (q.kind === 'check') {
      if (q.required && b[q.id] !== true) return need('Tick this to send the form.')
      fields[q.id] = b[q.id] === true ? 'Yes' : ''
      continue
    }
    if (q.kind === 'multi') {
      const picked = Array.isArray(b[q.id]) ? (q.options ?? []).filter((o) => (b[q.id] as unknown[]).includes(o.id)) : []
      if (q.required && !picked.length) return need('Pick at least one.')
      fields[q.id] = picked.map((o) => o.label).join('\n')
      continue
    }
    if (q.kind === 'choice') {
      const v = str(q.id)
      const o = (q.options ?? []).find((x) => x.id === v)
      if (q.required && !o) return need('Pick one.')
      fields[q.id] = o?.label ?? ''
      continue
    }
    const v = q.kind === 'textarea' ? long(q.id) : str(q.id, q.kind === 'url' ? 300 : 160)
    if (q.required && !v) return need('This one is needed.')
    if (q.kind === 'email' && !EMAIL.test(v)) return need('That does not look like a working email.')
    if (q.kind === 'tel') {
      const digits = v.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '')
      if (digits.length !== 10) return need('Enter exactly 10 digits, no +91.')
      fields[q.id] = `+91${digits}`
      continue
    }
    fields[q.id] = q.kind === 'email' ? normaliseEmail(v) : v
  }
  const { email: speakerEmail, ...rest } = fields
  return { email: speakerEmail!, fields: rest }
}

const TITLES: Record<FormKind, string> = { speak: 'Speaker interest', report: 'Report' }
const LABELS: Record<string, string> = {
  ...Object.fromEntries(SPEAKER_FORM.flatMap((sec) => sec.questions).map((q) => [q.id, q.kind === 'check' ? 'Acknowledged' : q.label])),
  about: 'About',
  name: 'Name',
  passId: 'Pass ID',
  detail: 'Detail',
}
export const fieldLabel = (k: string) => LABELS[k] ?? k

/** Stores the submission, then tells the organisers. A failed mail never loses the submission: the admin inbox has it. */
export async function submitForm(kind: FormKind, checked: Checked): Promise<Submission> {
  const createdAt = new Date().toISOString()
  const ref = newRef(kind, Boolean(checked.urgent))
  const item: Submission = { PK: `FORM#${kind}`, SK: `${createdAt}#${ref}`, kind, ref, createdAt, email: checked.email, fields: checked.fields, ...(kind === 'report' ? { urgent: Boolean(checked.urgent) } : {}) }
  await ddb.send(new PutCommand({ TableName: tableName(), Item: item }))

  const headline = kind === 'speak' ? `${checked.fields.name}, ${checked.fields.org}` : checked.fields.about
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
