import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { cookies } from 'next/headers'
import { ddb, tableName } from '../db/client'
import { normaliseEmail } from '../db/keys'
import { withinRateLimit } from '../db/rate-limit'
import { sendEmail } from '../email/send'
import { volunteerCode } from '../email/templates'
import { getUser } from './crew'

/**
 * Volunteer sign in, by email code, with no password and no Cognito account
 * (organiser's decision, 9 October 2026). An admin adds the volunteer's email
 * on the crew page; the volunteer types it, gets a six digit code by email,
 * and is in for a week. The session is a signed cookie naming the email, and
 * every request still checks the crew list, so removing someone there ends
 * their session on the spot. Only the volunteer role signs in this way:
 * admins keep their password.
 */

export const VOLUNTEER_COOKIE = 'scd_vol'
const SESSION_DAYS = 7
const CODE_MINUTES = 10
const MAX_TRIES = 5

const secret = () => {
  const s = process.env.SCD_SESSION_SECRET?.trim()
  if (!s) throw new Error('SCD_SESSION_SECRET is not set; volunteer sign in is off.')
  return s
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')
const codeHash = (email: string, code: string) => createHash('sha256').update(`${email}:${code}:${secret()}`).digest('hex')
const codeKey = (email: string) => ({ PK: `VOLCODE#${email}`, SK: 'CODE' })

export const volunteerSignInOn = () => Boolean(process.env.SCD_SESSION_SECRET?.trim())

/** The email in a valid, unexpired volunteer cookie, or null. */
export async function volunteerFromCookie(): Promise<string | null> {
  const raw = (await cookies()).get(VOLUNTEER_COOKIE)?.value
  if (!raw || !volunteerSignInOn()) return null
  const [email64, exp, mac] = raw.split('.')
  if (!email64 || !exp || !mac) return null
  const want = Buffer.from(sign(`${email64}.${exp}`))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  if (Number(exp) < Date.now()) return null
  return Buffer.from(email64, 'base64url').toString('utf8')
}

export type CodeRequest = { ok: true } | { ok: false; message: string }

/**
 * Emails a code to a volunteer on the crew list. The answer is the same
 * whether or not the email is on the list, so the form cannot be used to
 * find out who is.
 */
export async function sendVolunteerCode(rawEmail: string): Promise<CodeRequest> {
  const email = normaliseEmail(rawEmail)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, message: 'That does not look like an email address.' }
  if (!(await withinRateLimit(`vol:${email}`, 'VOLCODE', 5))) return { ok: false, message: 'Too many codes asked for this email. Wait an hour and try again.' }
  const user = await getUser(email)
  if (user?.role !== 'volunteer') return { ok: true }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: { ...codeKey(email), hash: codeHash(email, code), tries: 0, until: Date.now() + CODE_MINUTES * 60_000, expiresAt: Math.floor(Date.now() / 1000) + 3600 },
    }),
  )
  try {
    await sendEmail({ to: email, ...volunteerCode(code, CODE_MINUTES) })
  } catch (err) {
    console.error('[volunteer] code mail failed', err)
    return { ok: false, message: 'We could not send the code just now. Try again in a minute.' }
  }
  return { ok: true }
}

export type CodeCheck = { ok: true; email: string } | { ok: false; message: string }

/** Checks the code; on a match the code is spent and the session cookie set. */
export async function verifyVolunteerCode(rawEmail: string, rawCode: string): Promise<CodeCheck> {
  const email = normaliseEmail(rawEmail)
  const code = rawCode.replace(/\D/g, '')
  const wrong = { ok: false as const, message: 'That code is wrong or has expired. Ask for a new one.' }
  if (code.length !== 6) return wrong
  const item = (await ddb.send(new GetCommand({ TableName: tableName(), Key: codeKey(email), ConsistentRead: true }))).Item
  if (!item || item.until < Date.now() || item.tries >= MAX_TRIES) return wrong
  if (item.hash !== codeHash(email, code)) {
    await ddb.send(new UpdateCommand({ TableName: tableName(), Key: codeKey(email), UpdateExpression: 'ADD tries :one', ExpressionAttributeValues: { ':one': 1 } }))
    return wrong
  }
  await ddb.send(new DeleteCommand({ TableName: tableName(), Key: codeKey(email) }))
  // Still a volunteer at the moment of sign in.
  if ((await getUser(email))?.role !== 'volunteer') return wrong

  const exp = String(Date.now() + SESSION_DAYS * 86_400_000)
  const email64 = Buffer.from(email).toString('base64url')
  ;(await cookies()).set(VOLUNTEER_COOKIE, `${email64}.${exp}.${sign(`${email64}.${exp}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
  return { ok: true, email }
}

/* ---------------------------------------------------------------------------
   Gate code (organiser's decision, 30 October 2026). Collecting every
   volunteer's email on the morning did not scale, so one short code an admin
   reads out signs anyone in as a volunteer under the name they type. The
   code lives in the table; making a new one changes its version, and every
   session signed in with the old one ends on its next request.
   --------------------------------------------------------------------------- */

const GATE_KEY = { PK: 'GATECODE', SK: 'CURRENT' }
/** No 0/O, 1/I/L: it is read out loud across a noisy gate. */
const GATE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const GATE_PREFIX = 'gate:'

type GateCode = { code: string; version: string; by: string; at: string }

export async function currentGateCode(): Promise<GateCode | null> {
  const item = (await ddb.send(new GetCommand({ TableName: tableName(), Key: GATE_KEY, ConsistentRead: true }))).Item
  return item ? (item as GateCode) : null
}

export async function newGateCode(by: string): Promise<GateCode> {
  const code = Array.from({ length: 6 }, () => GATE_ALPHABET[randomInt(GATE_ALPHABET.length)]).join('')
  const next: GateCode = { code, version: String(randomInt(1e9)), by, at: new Date().toISOString() }
  await ddb.send(new PutCommand({ TableName: tableName(), Item: { ...GATE_KEY, ...next } }))
  return next
}

/** The name behind a gate code session, while that code is still the current one. */
export async function gateVolunteer(identity: string): Promise<string | null> {
  const [version, ...rest] = identity.slice(GATE_PREFIX.length).split(':')
  const gate = await currentGateCode()
  return gate && gate.version === version ? rest.join(':') : null
}

/** Signs a volunteer in with the gate code, for the day, under the name they gave. */
export async function signInWithGateCode(rawName: string, rawCode: string, ip: string): Promise<CodeCheck> {
  const name = rawName.replace(/\s+/g, ' ').trim().slice(0, 40)
  if (name.length < 2) return { ok: false, message: 'Type your name, so the gate log shows who scanned.' }
  if (!(await withinRateLimit(ip, 'GATECODE', 20))) return { ok: false, message: 'Too many tries from this phone. Ask an admin.' }
  const gate = await currentGateCode()
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const want = Buffer.from(gate?.code ?? '-')
  const got = Buffer.from(code)
  if (!gate || want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, message: 'That gate code is wrong. Ask an admin for today’s code.' }

  const exp = String(Date.now() + 86_400_000)
  const id64 = Buffer.from(`${GATE_PREFIX}${gate.version}:${name}`).toString('base64url')
  ;(await cookies()).set(VOLUNTEER_COOKIE, `${id64}.${exp}.${sign(`${id64}.${exp}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86_400,
  })
  return { ok: true, email: name }
}
