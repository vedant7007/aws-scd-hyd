/**
 * The v3 registration lifecycle against the real sandbox table. Nothing is
 * mocked: every assertion is about what DynamoDB actually did. Emails go
 * through the console transport and are counted there.
 *
 *   SEED_TEST_MODEL=1 npm run seed
 *   npm run test:lifecycle            # library level
 *   TEST_BASE_URL=http://localhost:3123 npm run test:lifecycle   # plus the HTTP checks
 *
 * Every record this creates carries a @scd-test.example address and is
 * deleted at the end, whatever happened. Session ceilings it changes are put
 * back.
 */
import assert from 'node:assert/strict'
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { randomBytes } from 'node:crypto'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassId } from '../src/lib/db/keys'
import { getAttendee, getAttendeeWithLog, listAttendees } from '../src/lib/db/queries'
import type { Attendee, RegistrationState, Session } from '../src/lib/db/types'
import { RECEIPT_FORBIDDEN_WORDS, confirmation, receipt, rejection } from '../src/lib/email/templates'
import { addUser, adminCount, getUser, removeUser, setRole } from '../src/lib/auth/crew'
import { REFUND_POLICY } from '../src/content/passes'
import { upiLink } from '../src/content/payment'
import { programSessions } from '../src/content/program'
import { adminReject, adminVerify, placeHold, submitPayment, sweepAbandoned } from '../src/lib/registration/flow'
import { normalisePhone, normaliseUtr, validateHold, type HoldInput } from '../src/lib/registration/validate'
import { outputs } from '../src/lib/outputs'
import { TRANSITIONS, abandon, reject, seatsOf, setRegistrationOpen, submitUtr, verify } from '../src/lib/registration/state'

const table = () => tableName()
const BASE = process.env.TEST_BASE_URL
/** Records made directly in a state: no seats were claimed for them. */
const created: string[] = []
/** Records made through placeHold: they hold real seats until abandoned. */
const holding: string[] = []
let passed = 0
const ok = (name: string) => {
  passed++
  console.log(`  ok  ${name}`)
}

/* ---- helpers ------------------------------------------------------------- */

let utrSeq = 0
const nextUtr = () => `TEST${Date.now()}${String(utrSeq++).padStart(3, '0')}`
const submissionKey = () => randomBytes(18).toString('base64url')

/** An attendee placed directly in a state, bypassing the flow, for transition tests. Holds no seats. */
async function seedIn(state: RegistrationState, extra: Partial<Attendee> = {}): Promise<Attendee> {
  const passId = newPassId()
  const now = new Date().toISOString()
  const a: Attendee = {
    ...keys.attendee(passId),
    ...gsi1.attendeeByPass(passId),
    passId,
    firstName: 'Test',
    lastName: state,
    name: `Test ${state}`,
    email: `${passId.toLowerCase()}@scd-test.example`,
    phone: '+919000000000',
    college: 'Test',
    branch: 'CSE',
    rollNumber: 'TEST0001',
    yearOfStudy: '2',
    dateOfBirth: '2004-01-01',
    tier: 'basic',
    technicalSession: 't1',
    state,
    amountPaise: 39900,
    submissionKeyHash: 'test',
    source: 'manual',
    createdAt: now,
    ...(state === 'AWAITING_PAYMENT' ? { holdUntil: new Date(Date.now() + 3600e3).toISOString() } : {}),
    ...(state !== 'AWAITING_PAYMENT' && state !== 'ABANDONED' ? { utr: nextUtr(), screenshotKey: `screenshots/${passId}/t.jpg` } : {}),
    ...extra,
  }
  await ddb.send(new PutCommand({ TableName: table(), Item: a }))
  created.push(passId)
  return a
}

const input = (over: Partial<HoldInput> = {}): HoldInput => ({
  tier: 'premium',
  technicalSession: 't1',
  workshop: 'w1',
  firstName: 'Hold',
  lastName: 'Test',
  email: `hold.${Date.now()}.${utrSeq++}@scd-test.example`,
  phone: '+919000000000',
  college: 'Test',
  branch: 'CSE',
  rollNumber: 'TEST0002',
  builderId: 'scdtest',
  yearOfStudy: '3',
  dateOfBirth: '2004-01-01',
  ...over,
})

/** placeHold, with the record remembered for cleanup. */
async function hold(i: HoldInput, key = submissionKey(), previous?: string) {
  const out = await placeHold(i, key, previous, 'manual')
  if (out.ok && !holding.includes(out.attendee.passId)) holding.push(out.attendee.passId)
  return out
}

async function session(id: string): Promise<Session | undefined> {
  return (await ddb.send(new GetCommand({ TableName: table(), Key: keys.session(id), ConsistentRead: true }))).Item as Session | undefined
}
const taken = async (id: string) => (await session(id))?.seatsTaken ?? 0

/** Ceilings as they were, put back at the end. */
const savedCeilings = new Map<string, { seatsTaken: number; sellableCapacity: number | null } | null>()
async function setFree(id: string, free: number): Promise<void> {
  const s = await session(id)
  if (!savedCeilings.has(id)) savedCeilings.set(id, s ? { seatsTaken: s.seatsTaken, sellableCapacity: s.sellableCapacity } : null)
  await ddb.send(
    new UpdateCommand({
      TableName: table(),
      Key: keys.session(id),
      UpdateExpression: 'SET sellableCapacity = :c, seatsTaken = if_not_exists(seatsTaken, :z), sessionId = :id',
      ExpressionAttributeValues: { ':c': (s?.seatsTaken ?? 0) + free, ':z': 0, ':id': id },
    }),
  )
}

/** Counts console-transport sends by recipient. */
const sent = new Map<string, number>()
const realInfo = console.info
console.info = (...args: unknown[]) => {
  const line = String(args[0] ?? '')
  const m = /^\[email:console\] to=(\S+)/.exec(line)
  if (m) sent.set(m[1]!, (sent.get(m[1]!) ?? 0) + 1)
}
const sends = (email: string) => sent.get(email.toLowerCase()) ?? 0

let cleaned = false
async function cleanup(): Promise<void> {
  if (cleaned) return
  cleaned = true
  console.info = realInfo
  for (const passId of [...created, ...holding]) {
    const { attendee, log } = await getAttendeeWithLog(passId)
    if (!attendee) continue
    // A placeHold record still holds its seats unless the sweep gave them back.
    if (holding.includes(passId) && attendee.state !== 'ABANDONED') {
      for (const s of seatsOf(attendee)) {
        await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.session(s), UpdateExpression: 'SET seatsTaken = seatsTaken - :one', ExpressionAttributeValues: { ':one': 1 } }))
      }
    }
    await ddb.send(new DeleteCommand({ TableName: table(), Key: keys.attendee(passId) }))
    if (attendee.utr) await ddb.send(new DeleteCommand({ TableName: table(), Key: keys.utr(attendee.utr) }))
    for (const l of log) await ddb.send(new DeleteCommand({ TableName: table(), Key: { PK: l.PK, SK: l.SK } }))
  }
  for (const [id, was] of savedCeilings) {
    if (!was) await ddb.send(new DeleteCommand({ TableName: table(), Key: keys.session(id) }))
    else if (was.sellableCapacity === undefined || was.sellableCapacity === null) await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.session(id), UpdateExpression: 'REMOVE sellableCapacity' }))
    else await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.session(id), UpdateExpression: 'SET sellableCapacity = :c', ExpressionAttributeValues: { ':c': was.sellableCapacity } }))
  }
}

/** DynamoDB returns attributes in no fixed order, so compare with sorted keys. */
const canon = (o: unknown) => JSON.stringify(o, o && typeof o === 'object' ? Object.keys(o as object).sort() : undefined)

/* ---- validation, no network ------------------------------------------------ */

function validation(): void {
  console.log('\nvalidation')
  const body = (over: Record<string, unknown> = {}) => ({ ...input({ email: 'v@scd-test.example' }), submissionKey: 'k'.repeat(24), ...over })
  const field = (b: unknown) => {
    const v = validateHold(b)
    return 'error' in v ? v.error.field : 'ok'
  }
  assert.equal(field(body()), 'ok')
  assert.equal(field(body({ amountPaise: 1 })), 'amountPaise', 'an amount in the body is refused')
  assert.equal(field(body({ tier: 'basic' })), 'workshop', 'Regular with a workshop is refused')
  assert.equal(field(body({ tier: 'basic', workshop: undefined })), 'ok')
  assert.equal(field(body({ workshop: undefined })), 'workshop', 'Premium without a workshop is refused')
  assert.equal(field(body({ technicalSession: 'w1' })), 'tech', 'a workshop is not a technical session')
  // 30 October 2026 is the event day: born 31 October 2008 is seventeen on it, born 30 October 2008 is eighteen.
  assert.equal(field(body({ dateOfBirth: '2008-10-31' })), 'dob', 'seventeen on the day is refused')
  assert.equal(field(body({ dateOfBirth: '2008-10-30' })), 'ok', 'eighteen on the day is allowed')
  assert.equal(field(body({ dateOfBirth: '2004-02-30' })), 'dob', 'an impossible date is refused')
  assert.equal(field(body({ phone: '12345' })), 'phone')
  assert.equal(normalisePhone('098765 43210'), '+919876543210')
  assert.equal(normalisePhone('+91 98765-43210'), '+919876543210')
  assert.equal(normaliseUtr(' 1234 5678 9012 '), '123456789012')
  assert.equal(normaliseUtr('axis1234567890ab'), 'AXIS1234567890AB')
  assert.equal(normaliseUtr('12345678901'), null, 'eleven characters is too short')
  assert.equal(normaliseUtr('1234-5678-9012'), null, 'punctuation is refused')
  const link = upiLink({ upiId: 'college@bank', payeeName: 'VJIT College', merchantCode: '8299' }, 'SCD-ABCDEFGHJK')
  assert.ok(link.startsWith('upi://pay?pa=college@bank&'), link)
  assert.ok(link.includes('pn=VJIT%20College') && link.includes('mc=8299') && !link.includes('am=') && link.includes('tn=SCD-ABCDEFGHJK') && link.includes('cu=INR') && !link.includes('+'), link)
  ok('server validation: amount, workshop by tier, age on the event day, phone, UTR shape and the UPI link')
}

/* ---- state machine --------------------------------------------------------- */

async function stateMachine(): Promise<void> {
  console.log('\nstate machine')
  const attempts: Partial<Record<RegistrationState, (a: Attendee) => Promise<{ ok?: boolean; abandoned?: boolean }>>> = {
    PENDING_VERIFICATION: (a) => submitUtr(a.passId, nextUtr(), 'screenshots/x/y.jpg'),
    ABANDONED: (a) => abandon(a.passId, new Date(Date.now() + 7200e3).toISOString()),
    VERIFIED: (a) => verify(a.passId, 'test@admin'),
    REJECTED: (a) => reject(a.passId, 'test@admin', 'no'),
  }
  let illegal = 0
  for (const from of Object.keys(TRANSITIONS) as RegistrationState[]) {
    for (const to of Object.keys(attempts) as RegistrationState[]) {
      if (TRANSITIONS[from].includes(to)) continue
      const a = await seedIn(from)
      const before = canon(await getAttendee(a.passId))
      const out = await attempts[to]!(a)
      assert.ok(!(out.ok === true || out.abandoned === true), `${from} -> ${to} should be refused`)
      assert.equal(canon(await getAttendee(a.passId)), before, `${from} -> ${to} changed the record`)
      illegal++
    }
  }
  ok(`${illegal} illegal transitions refused, each leaving the record byte for byte unchanged`)

  const p = await seedIn('PENDING_VERIFICATION')
  const [v1, v2] = await Promise.all([adminVerify(p.passId, 'a@admin'), adminVerify(p.passId, 'b@admin')])
  assert.equal([v1, v2].filter((r) => r.ok).length, 1, 'exactly one verify succeeded')
  assert.equal((await getAttendee(p.passId))?.state, 'VERIFIED')
  assert.equal(sends(p.email), 1, 'exactly one email 2')
  ok('two concurrent verifies: one transition, one email 2')
}

/* ---- holds and seats --------------------------------------------------------- */

async function holds(): Promise<void> {
  console.log('\nholds and seats')
  for (const s of programSessions) await setFree(s.id, 3)

  // A hold claims one seat in the technical session and one in the workshop.
  const [t1, t2, w1, w2] = await Promise.all(['t1', 't2', 'w1', 'w2'].map(taken))
  const key = submissionKey()
  const first = await hold(input(), key)
  assert.ok(first.ok, 'hold placed')
  if (!first.ok) return
  const a = first.attendee
  assert.equal(a.state, 'AWAITING_PAYMENT')
  assert.equal(a.amountPaise, (await import('../src/lib/tickets/pricing')).amountFor('premium').amountPaise, 'amount decided by the server')
  assert.deepEqual([await taken('t1'), await taken('w1')], [t1! + 1, w1! + 1])
  ok('a Premium hold claims its technical session and its workshop, at the server price')

  // Editing from the review step moves the same record's seats.
  const moved = await hold(input({ email: a.email, technicalSession: 't2', workshop: 'w2' }), key, a.passId)
  assert.ok(moved.ok && moved.moved && moved.attendee.passId === a.passId, 'same record moved')
  assert.equal(moved.ok && moved.attendee.holdUntil, a.holdUntil, 'the hold clock is kept')
  assert.deepEqual([await taken('t1'), await taken('t2'), await taken('w1'), await taken('w2')], [t1, t2! + 1, w1, w2! + 1])
  ok('editing moves the seats on the same record and keeps the clock')

  // Another browser sending this pass id cannot touch it.
  const other = await hold(input({ technicalSession: 't5', workshop: 'w1' }), submissionKey(), a.passId)
  assert.ok(other.ok && other.attendee.passId !== a.passId, 'a stranger gets their own record')
  assert.equal((await getAttendee(a.passId))?.technicalSession, 't2', 'the original is untouched')
  ok('a pass id sent with a different submission key makes a new record and leaves the original alone')

  // Premium down to Regular drops the workshop seat.
  const down = await hold(input({ email: a.email, tier: 'basic', technicalSession: 't2', workshop: undefined }), key, a.passId)
  assert.ok(down.ok && down.moved && !down.attendee.workshop)
  assert.equal(await taken('w2'), w2, 'workshop seat given back')
  ok('dropping to Regular gives the workshop seat back')

  // A full session: refused, named, nothing written.
  await setFree('t4', 0)
  const before = (await listAttendees()).length
  const full = await hold(input({ technicalSession: 't4' }))
  assert.ok(!full.ok && full.sessionId === 't4')
  assert.equal((await listAttendees()).length, before, 'no record made')
  ok('a hold on a full session is refused naming it, with no record made')

  // UTR in: PENDING, receipt sent; the same UTR elsewhere refused by the table.
  const utr = nextUtr()
  const sub = await submitPayment(a.passId, utr, `screenshots/${a.passId}/s.jpg`)
  assert.ok(sub.ok && sub.attendee.state === 'PENDING_VERIFICATION' && !sub.attendee.holdUntil)
  assert.equal(sends(a.email), 1, 'email 1 sent')
  if (!other.ok) return
  const dup = await submitPayment(other.attendee.passId, utr, 'screenshots/x/y.jpg')
  assert.ok(!dup.ok && dup.reason === 'utr-used')
  ok('UTR submitted: pending, receipt sent, and the same UTR on another pass is refused')

  // Reject keeps the seats; resubmitting with the same UTR is allowed; verify.
  const t2Held = await taken('t2')
  assert.ok((await adminReject(a.passId, 'test@admin', 'Amount did not match')).ok)
  assert.equal(await taken('t2'), t2Held, 'rejected record keeps its seat')
  assert.ok((await submitPayment(a.passId, utr, `screenshots/${a.passId}/s2.jpg`)).ok, 'resubmitted with the same UTR')
  assert.ok((await adminVerify(a.passId, 'test@admin')).ok)
  assert.equal((await getAttendee(a.passId))?.state, 'VERIFIED')
  ok('reject keeps the seats, the student resubmits, verify moves it to VERIFIED')

  // The sweep: a lapsed hold is deleted and gives its seats back.
  const t5 = await taken('t5')
  const w1Now = await taken('w1')
  // Lapse only this record's hold, so the sweep touches nothing else in the table.
  await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.attendee(other.attendee.passId), UpdateExpression: 'SET holdUntil = :past', ExpressionAttributeValues: { ':past': new Date(Date.now() - 60_000).toISOString() } }))
  const swept = await sweepAbandoned()
  assert.ok(swept.abandoned >= 1)
  assert.equal(await getAttendee(other.attendee.passId), null, 'the record is gone')
  assert.deepEqual([await taken('t5'), await taken('w1')], [t5 - 1, w1Now - 1])
  ok('sweep: a lapsed hold is deleted and both its seats given back')

  // Restarting after the hold lapsed: a fresh record.
  const again = await hold(input({ email: a.email }), key, other.attendee.passId)
  assert.ok(again.ok && again.attendee.passId !== other.attendee.passId && !again.moved)
  ok('a pass id that is no longer a live hold is never revived; a fresh hold is made')
}

/* ---- emails --------------------------------------------------------------- */

function emails(): void {
  console.log('\nemails')
  const person = { name: 'Test Person', passId: 'SCD-TESTTESTTE', tier: 'premium', technicalSession: 't1', workshop: 'w1', amountPaise: 79900 } as const
  const r = receipt(person)
  for (const w of RECEIPT_FORBIDDEN_WORDS) assert.ok(!new RegExp(`\\b${w}\\b`, 'i').test(`${r.subject}\n${r.text}`), `email 1 says "${w}"`)
  ok(`email 1 contains none of: ${RECEIPT_FORBIDDEN_WORDS.join(', ')}`)
  const rej = rejection(person, 'UTR123456789012', 'Amount did not match')
  assert.ok(rej.text.includes('UTR123456789012') && !rej.text.includes('/pass/'))
  ok('rejection email quotes the UTR and contains no pass link')
  const c = confirmation(person)
  assert.ok(c.text.includes(REFUND_POLICY) && c.text.includes('SCD-TESTTESTTE') && !c.text.includes('/pass/') && !c.html.includes('/pass/'), 'payment verified mail, no ticket')
  for (const t of [r.text, rej.text, c.text]) assert.ok(!t.includes('—'), 'an email carries an em dash')
  ok('email 2 says payment verified with the pass id and refund wording, and carries no ticket; no email carries an em dash')
}

/* ---- http ----------------------------------------------------------------- */

async function http(): Promise<void> {
  if (!BASE) {
    console.log('\nhttp: skipped, set TEST_BASE_URL to run')
    return
  }
  console.log(`\nhttp against ${BASE}`)
  const form = (passId: string) => fetch(`${BASE}/pass/lookup`, { method: 'POST', body: new URLSearchParams({ passId }), redirect: 'manual' })
  const strip = (r: Response) => [...r.headers.entries()].filter(([k]) => !['date', 'x-nextjs-cache', 'etag'].includes(k)).sort().map(([k, v]) => `${k}: ${v}`).join('\n')

  const pend = await seedIn('PENDING_VERIFICATION')
  const [unknown, pending] = await Promise.all([form('SCD-ZZZZZZZZZZ'), form(pend.passId)])
  const ub = await unknown.arrayBuffer()
  const pb = await pending.arrayBuffer()
  assert.equal(unknown.status, pending.status)
  assert.equal(strip(unknown), strip(pending), 'headers differ')
  assert.ok(Buffer.from(ub).equals(Buffer.from(pb)), 'bodies differ')
  ok(`unknown id and PENDING_VERIFICATION id: byte-identical ${unknown.status} responses`)

  const ver = await seedIn('VERIFIED')
  const bare = ver.passId.slice(4)
  for (const f of [ver.passId.toLowerCase(), `scd ${bare.toLowerCase()}`, `SCD${bare}`]) {
    const r = await form(f)
    assert.equal(r.status, 303)
    assert.equal(r.headers.get('location'), `/pass/${ver.passId}`, `${JSON.stringify(f)} did not resolve`)
  }
  ok('lowercase, spaced and unhyphenated forms of a verified id all resolve to the pass')

  const page = await fetch(`${BASE}/pass/${pend.passId}`)
  assert.equal(page.status, 404)
  const html = await page.text()
  assert.ok(!html.includes(pend.email) && !html.includes(pend.utr!), 'the 404 leaks the record')
  const verPage = await (await fetch(`${BASE}/pass/${ver.passId}`)).text()
  assert.ok(verPage.includes(ver.passId) && verPage.includes('Cloud 101'), 'the ticket shows the pass and its session')
  ok('the pass page is a 404 until VERIFIED, then shows the ticket with its session')

  const shot = await fetch(`${BASE}/admin/screenshot/${pend.passId}`, { redirect: 'manual' })
  const body = await shot.text()
  assert.equal(shot.status, 403)
  assert.ok(!/@/.test(body) && !body.includes(pend.passId))
  ok('non-admin screenshot request: 403 with no address and no id')

}

/* ---- the switch ----------------------------------------------------------- */

async function theSwitch(): Promise<void> {
  console.log('\nregistration switch')
  const before = (await import('../src/lib/db/queries').then((m) => m.getConfig()))?.registrationOpen
  await setRegistrationOpen(false, 'test@admin')
  // Always put the switch back, even when a check fails, or the sandbox is left closed.
  try {
    const inFlight = await seedIn('AWAITING_PAYMENT')
    assert.ok((await submitUtr(inFlight.passId, nextUtr(), `screenshots/${inFlight.passId}/t.jpg`)).ok, 'UTR accepted while closed')
    assert.ok((await verify(inFlight.passId, 'test@admin')).ok, 'verification works while closed')
    ok('closed: an in-flight record submits its UTR and is verified as normal')

    if (BASE && process.env.SCD_DEV_REGISTRATION_OPEN !== '1') {
      const email = `closed.${Date.now()}@scd-test.example`
      const r = await fetch(`${BASE}/api/registrations/hold`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...input({ email }), submissionKey: submissionKey() }),
      })
      assert.equal(r.status, 403)
      assert.ok(!(await listAttendees()).some((a) => a.email === email), 'no record was created by the refused POST')
      ok('closed: a direct POST to the hold route is a 403 and creates nothing')
    }
  } finally {
    await setRegistrationOpen(before ?? true, 'test@admin')
  }
}

async function roles(): Promise<void> {
  console.log('\nroles')
  const stamp = Date.now()
  const a = `admin.a.${stamp}@scd-test.example`
  const b = `admin.b.${stamp}@scd-test.example`
  const vol = `vol.${stamp}@scd-test.example`
  const cleanupUsers = async () => {
    for (const e of [a, b, vol]) await ddb.send(new DeleteCommand({ TableName: table(), Key: keys.user(e) }))
  }
  const admins0 = await adminCount()
  const metaKey = keys.usersMeta()
  try {
    assert.ok((await addUser(a, 'admin', 'test')).ok)
    assert.ok((await addUser(vol, 'volunteer', 'test')).ok)
    assert.equal((await getUser(vol))?.role, 'volunteer')
    if (admins0 === 0) {
      assert.equal((await setRole(a, 'volunteer', a)).ok, false, 'the last admin cannot demote themselves')
      assert.equal((await removeUser(a, a)).ok, false, 'the last admin cannot remove themselves')
      assert.equal((await getUser(a))?.role, 'admin', 'still an admin')
    }
    assert.ok((await addUser(b, 'admin', a)).ok)
    assert.ok((await setRole(a, 'volunteer', a)).ok, 'with a second admin present, demotion goes through')
    assert.equal((await adminCount()), admins0 + 1)
    if (admins0 === 0) assert.equal((await removeUser(b, b)).ok, false, 'b is now the last admin and cannot be removed')
    ok(`last admin protected: demote and remove refused while alone, allowed once another admin exists${admins0 ? ' (table already had admins, only the allowed path checked)' : ''}`)
  } finally {
    await cleanupUsers()
    await ddb.send(new UpdateCommand({ TableName: table(), Key: metaKey, UpdateExpression: 'SET admins = :n', ExpressionAttributeValues: { ':n': admins0 } }))
  }

  // No password in the create flow: whatever is logged and returned while an account is made and removed.
  const admin = await import('../src/lib/auth/admin')
  const lines: string[] = []
  const grab = (...args: unknown[]) => lines.push(args.map(String).join(' '))
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info }
  console.log = grab
  console.warn = grab
  console.error = grab
  console.info = grab
  let made: unknown
  try {
    made = await admin.createCrewAccount(vol)
    await admin.deleteCrewAccount(vol)
  } finally {
    Object.assign(console, saved)
  }
  assert.deepEqual(Object.keys(made as object), ['created'], 'the create call returns nothing but the flag')
  assert.ok(!lines.some((l) => /password/i.test(l)), 'nothing logged mentions a password')
  assert.equal(sends(vol), 0, 'the application emailed nothing')
  ok('account creation returns and logs no password and sends no email')
}

async function volunteerHttp(): Promise<void> {
  if (!BASE) return
  console.log('\nvolunteer over http')
  const out = outputs()
  const poolId = out?.auth?.user_pool_id ?? process.env.COGNITO_USER_POOL_ID
  const clientId = out?.auth?.user_pool_client_id ?? process.env.COGNITO_USER_POOL_CLIENT_ID
  if (!poolId || !clientId) {
    console.log('  skipped: no Cognito pool in amplify_outputs.json')
    return
  }
  const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? 'ap-south-1' })
  const vol = `gate.${Date.now()}@scd-test.example`
  const password = `T${randomBytes(12).toString('base64url')}a1!`
  const pend = await seedIn('PENDING_VERIFICATION')
  try {
    await cognito.send(new AdminCreateUserCommand({ UserPoolId: poolId, Username: vol, MessageAction: 'SUPPRESS', UserAttributes: [{ Name: 'email', Value: vol }, { Name: 'email_verified', Value: 'true' }] }))
    await cognito.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: vol, Password: password, Permanent: true }))
    assert.ok((await addUser(vol, 'volunteer', 'test')).ok)
    const auth = await cognito.send(new InitiateAuthCommand({ AuthFlow: 'USER_PASSWORD_AUTH', ClientId: clientId, AuthParameters: { USERNAME: vol, PASSWORD: password } }))
    const refresh = auth.AuthenticationResult?.RefreshToken
    assert.ok(refresh, 'volunteer signed in')
    const as = (path: string, init: RequestInit = {}) => fetch(`${BASE}${path}`, { ...init, redirect: 'manual', headers: { ...(init.headers ?? {}), cookie: `scd_admin=${refresh}` } })

    // The chrome names the public contact address and the crew bar names the volunteer. Nobody else may appear.
    const noLeak = async (r: Response, what: string) => {
      const body = await r.text()
      const addresses = [...new Set(body.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [])].filter((a) => a !== vol && a !== 'awssbgvjit@gmail.com')
      assert.deepEqual(addresses, [], `${what}: body carries an address`)
      assert.ok(!body.includes(pend.passId), `${what}: body carries a pass id`)
      assert.ok(!/scd-test.example|example.test/.test(body.replace(vol, '')), `${what}: body carries an attendee domain`)
    }
    for (const path of ['/admin', '/admin/users', '/admin/settings']) {
      const r = await as(path)
      assert.ok(r.status >= 300 && r.status < 400, `${path} is not a redirect for a volunteer: ${r.status}`)
      assert.equal(new URL(r.headers.get('location') ?? '', BASE).pathname, '/admin/scan')
      await noLeak(r, path)
    }
    const csv = await as('/api/admin/attendees-csv')
    assert.equal(csv.status, 403)
    await noLeak(csv, 'attendees-csv')
    const shot = await as(`/admin/screenshot/${pend.passId}`)
    assert.equal(shot.status, 403)
    await noLeak(shot, 'screenshot')
    const scanPage = await as('/admin/scan')
    assert.equal(scanPage.status, 200, 'the scanner is the volunteer\'s page')
    const scan = await as('/api/admin/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passId: pend.passId, action: 'lookup' }) })
    assert.equal(scan.status, 200, 'the scan route serves a volunteer')
    ok('volunteer: dashboard, crew and settings redirect to the scanner, export and screenshot are 403, no address or id in any body, scanner works')
  } finally {
    await removeUser(vol, 'test')
    try {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: vol }))
    } catch {
      // Never created.
    }
  }
}

/* ---- run ------------------------------------------------------------------ */

async function main(): Promise<void> {
  try {
    validation()
    emails()
    await stateMachine()
    await holds()
    await http()
    await theSwitch()
    await roles()
    await volunteerHttp()
    console.log(`\n${passed} checks passed`)
  } finally {
    await cleanup()
  }
}

main().catch(async (err) => {
  console.error('\nFAILED:', err)
  await cleanup()
  process.exit(1)
})
