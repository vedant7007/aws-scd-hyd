/**
 * Amendment 1 section 9 and Amendment 2 section 6, against the real sandbox
 * table. Nothing is mocked: every assertion is about what DynamoDB actually
 * did. Emails go through the console transport and are counted there.
 *
 *   SEED_TEST_MODEL=1 npm run seed
 *   npm run test:lifecycle            # library level
 *   TEST_BASE_URL=http://localhost:3123 npm run test:lifecycle   # plus the HTTP checks
 *
 * Every record this creates carries a @scd-test.example address and is
 * deleted at the end, whatever happened.
 */
import assert from 'node:assert/strict'
import { DeleteCommand, GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassId, normalisePassId } from '../src/lib/db/keys'
import { getAttendee, getAttendeeWithSeats, getTrackCounters } from '../src/lib/db/queries'
import { releaseItems } from '../src/lib/db/seats'
import type { Attendee, RegistrationState, Session, Track, TrackCounter } from '../src/lib/db/types'
import * as send from '../src/lib/email/send'
import { RECEIPT_FORBIDDEN_WORDS, receipt, rejection } from '../src/lib/email/templates'
import { adminReject, adminVerify, changeSelection, sendSessionsLive, sweepAbandoned, validatePicks } from '../src/lib/registration/flow'
import {
  TRANSITIONS,
  abandon,
  registerStepOne,
  reinstate,
  reject,
  selectSessions,
  submitUtr,
  verify,
  verifyByProvider,
} from '../src/lib/registration/state'
import { slots } from '../src/content/event'

const table = () => tableName()
const BASE = process.env.TEST_BASE_URL
const created: string[] = []
let passed = 0
const ok = (name: string) => {
  passed++
  console.log(`  ok  ${name}`)
}

/* ---- helpers ------------------------------------------------------------- */

let utrSeq = 700000000000
const nextUtr = () => String(utrSeq++)

/** An attendee placed directly in a state, bypassing the flow, for transition tests. */
async function seedIn(state: RegistrationState, extra: Partial<Attendee> = {}): Promise<Attendee> {
  const passId = newPassId()
  const now = new Date().toISOString()
  const a: Attendee = {
    ...keys.attendee(passId),
    ...gsi1.attendeeByPass(passId),
    passId,
    name: `Test ${state}`,
    email: `${passId.toLowerCase()}@scd-test.example`,
    phone: '+919000000000',
    college: 'Test',
    tier: 'basic',
    homeTrack: 'ai',
    foodPreference: 'veg',
    state,
    paymentMode: 'manual',
    amountPaise: 39900,
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

async function counter(track: Track): Promise<TrackCounter> {
  const c = (await getTrackCounters()).find((x) => x?.track === track)
  if (!c) throw new Error(`no counter for ${track}`)
  return c
}
async function setCounter(track: Track, registered: number, ceiling: number): Promise<void> {
  await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.trackCounter(track), UpdateExpression: 'SET registered = :r, ceiling = :c', ExpressionAttributeValues: { ':r': registered, ':c': ceiling } }))
}
async function session(id: string): Promise<Session> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.session(id) }))
  return res.Item as Session
}
async function setFree(id: string, free: number): Promise<void> {
  const s = await session(id)
  await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.session(id), UpdateExpression: 'SET sellableCapacity = :c', ExpressionAttributeValues: { ':c': s.seatsTaken + free } }))
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

async function cleanup(): Promise<void> {
  console.info = realInfo
  for (const passId of created) {
    const { attendee, seats } = await getAttendeeWithSeats(passId)
    if (!attendee) continue
    const items = [{ Delete: { TableName: table(), Key: keys.attendee(passId) } }, ...releaseItems(seats)]
    if (attendee.utr) items.push({ Delete: { TableName: table(), Key: keys.utr(attendee.utr) } })
    try {
      await ddb.send(new TransactWriteCommand({ TransactItems: items }))
    } catch {
      await ddb.send(new DeleteCommand({ TableName: table(), Key: keys.attendee(passId) }))
    }
    // The state-change log items under the partition.
    for (const l of (await getAttendeeWithSeats(passId)).log) await ddb.send(new DeleteCommand({ TableName: table(), Key: { PK: l.PK, SK: l.SK } }))
  }
}

/** DynamoDB returns attributes in no fixed order, so compare with sorted keys. */
const canon = (o: unknown) => JSON.stringify(o, o && typeof o === 'object' ? Object.keys(o as object).sort() : undefined)

const picksAll = (track: Track) => Object.fromEntries(slots.map((s) => [s.id, `${s.id}-${track}`]))
const pickList = (input: Record<string, string>) => validatePicks({ tier: 'vip', homeTrack: 'ai' }, input)

/* ---- state machine --------------------------------------------------------- */

async function stateMachine(): Promise<void> {
  console.log('\nstate machine')
  const attempts: Record<RegistrationState, (a: Attendee) => Promise<unknown>> = {
    PENDING_VERIFICATION: (a) => submitUtr(a.passId, nextUtr(), 'screenshots/x/y.jpg'),
    ABANDONED: (a) => abandon(a.passId, new Date(Date.now() + 7200e3).toISOString()),
    VERIFIED: (a) => verify(a.passId, 'test@admin'),
    REJECTED: (a) => reject(a.passId, 'test@admin', 'no'),
    SESSIONS_SELECTED: async (a) => {
      const v = pickList(picksAll('ai'))
      if (!v.ok) throw new Error(v.message)
      return selectSessions(a.passId, v.picks)
    },
    AWAITING_PAYMENT: async () => ({ ok: false }),
  }
  const reinstateAttempt = (a: Attendee) => reinstate(a.passId, 'test@admin', nextUtr())

  let illegal = 0
  for (const from of Object.keys(TRANSITIONS) as RegistrationState[]) {
    for (const to of Object.keys(attempts) as RegistrationState[]) {
      if (to === 'AWAITING_PAYMENT' || TRANSITIONS[from].includes(to)) continue
      const a = await seedIn(from)
      const before = canon(await getAttendee(a.passId))
      const fn = to === 'PENDING_VERIFICATION' && from === 'ABANDONED' ? reinstateAttempt : attempts[to]
      const out = (await fn(a)) as { ok?: boolean; abandoned?: boolean }
      assert.ok(!(out.ok === true || out.abandoned === true), `${from} -> ${to} should be refused`)
      assert.equal(canon(await getAttendee(a.passId)), before, `${from} -> ${to} changed the record`)
      illegal++
    }
  }
  ok(`${illegal} illegal transitions refused, each leaving the record byte for byte unchanged`)

  // Two concurrent verifies: one state change, one email 2.
  const p = await seedIn('PENDING_VERIFICATION')
  const [v1, v2] = await Promise.all([adminVerify(p.passId, 'a@admin'), adminVerify(p.passId, 'b@admin')])
  assert.equal([v1, v2].filter((r) => r.ok).length, 1, 'exactly one verify succeeded')
  assert.equal((await getAttendee(p.passId))?.state, 'VERIFIED')
  assert.equal(sends(p.email), 1, 'exactly one email 2')
  ok('two concurrent verifies: one transition, one email 2')

  // Double-submitted form: one record, counter +1.
  const c0 = (await counter('ai')).registered
  const reg = { name: 'Double', email: 'double@scd-test.example', phone: '+919000000001', college: 'T', tier: 'basic' as const, homeTrack: 'ai' as const, foodPreference: 'veg' as const }
  const key = `dbl${Date.now()}`
  const setup = { mode: 'manual' as const, amountPaise: 39900, holdUntil: new Date(Date.now() + 3600e3).toISOString(), submissionKey: key }
  const [r1, r2] = await Promise.all([registerStepOne(newPassId(), reg, setup), registerStepOne(newPassId(), reg, setup)])
  assert.ok(r1.ok && r2.ok, 'both submissions resolve')
  if (r1.ok && r2.ok) {
    assert.equal(r1.attendee.passId, r2.attendee.passId, 'both resolve to the same record')
    assert.equal([r1, r2].filter((r) => r.ok && r.duplicate).length, 1, 'exactly one was the duplicate')
    created.push(r1.attendee.passId)
  }
  assert.equal((await counter('ai')).registered, c0 + 1, 'counter moved by exactly one')
  await ddb.send(new DeleteCommand({ TableName: table(), Key: { PK: `SUBMIT#${key}`, SK: 'REG' } }))
  ok('double-submitted form: one record, counter +1')
}

/* ---- track counter --------------------------------------------------------- */

async function trackCounter(): Promise<void> {
  console.log('\ntrack counter')
  const orig = await counter('career')
  await setCounter('career', orig.registered, orig.registered + 2)
  const reg = (n: number) => ({ name: `Fill ${n}`, email: `fill${n}@scd-test.example`, phone: '+919000000002', college: 'T', tier: 'basic' as const, homeTrack: 'career' as const, foodPreference: 'veg' as const })
  const setup = (k: string) => ({ mode: 'manual' as const, amountPaise: 39900, holdUntil: new Date(Date.now() + 3600e3).toISOString(), submissionKey: k })
  const a = await registerStepOne(newPassId(), reg(1), setup(`f1${Date.now()}`))
  const b = await registerStepOne(newPassId(), reg(2), setup(`f2${Date.now()}`))
  assert.ok(a.ok && b.ok, 'two registrations fill the track')
  if (a.ok) created.push(a.attendee.passId)
  if (b.ok) created.push(b.attendee.passId)
  const third = newPassId()
  const c = await registerStepOne(third, reg(3), setup(`f3${Date.now()}`))
  assert.deepEqual(c, { ok: false, reason: 'track-full', track: 'career' })
  assert.equal(await getAttendee(third), null, 'no record for the refused registration')
  assert.equal((await counter('career')).registered, orig.registered + 2)
  ok('third registration refused at step one with track-full; no record, counter at ceiling')

  // Sweep: expired AWAITING to ABANDONED, counter -1.
  await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.attendee((a as { attendee: Attendee }).attendee.passId), UpdateExpression: 'SET holdUntil = :h', ExpressionAttributeValues: { ':h': new Date(Date.now() - 60e3).toISOString() } }))
  const swept = await sweepAbandoned()
  assert.ok(swept.abandoned >= 1, 'sweep abandoned the lapsed record')
  assert.equal((await getAttendee((a as { attendee: Attendee }).attendee.passId))?.state, 'ABANDONED')
  assert.equal((await counter('career')).registered, orig.registered + 1, 'counter down by exactly one')
  ok('sweep: lapsed AWAITING_PAYMENT to ABANDONED, counter decremented by exactly one')

  // Simulated failure between state change and decrement: make the decrement impossible.
  const bId = (b as { attendee: Attendee }).attendee.passId
  await ddb.send(new UpdateCommand({ TableName: table(), Key: keys.attendee(bId), UpdateExpression: 'SET holdUntil = :h', ExpressionAttributeValues: { ':h': new Date(Date.now() - 60e3).toISOString() } }))
  await setCounter('career', 0, orig.registered + 2)
  const failed = await abandon(bId)
  assert.equal(failed.abandoned, false, 'transaction refused when the decrement cannot happen')
  assert.equal((await getAttendee(bId))?.state, 'AWAITING_PAYMENT', 'state untouched when the decrement failed')
  assert.equal((await counter('career')).registered, 0, 'counter untouched when the state change was rolled back')
  await setCounter('career', orig.registered + 1, orig.registered + 2)
  assert.equal((await abandon(bId)).abandoned, true, 'the same sweep succeeds once the decrement can happen')
  assert.equal((await counter('career')).registered, orig.registered)
  ok('state change and decrement are one transaction: neither happens without the other')

  // Reinstate into a full track fails loudly.
  await setCounter('career', orig.registered + 2, orig.registered + 2)
  const rs = await reinstate(bId, 'test@admin', nextUtr())
  assert.deepEqual(rs, { ok: false, reason: 'track-full', track: 'career' })
  assert.equal((await getAttendee(bId))?.state, 'ABANDONED', 'still abandoned')
  assert.equal((await counter('career')).registered, orig.registered + 2, 'counter unchanged')
  await setCounter('career', orig.registered, orig.ceiling ?? orig.registered + 4)
  ok('reinstate into a now-full track: refused with track-full, nothing changed')
}

/* ---- emails ---------------------------------------------------------------- */

async function emails(): Promise<void> {
  console.log('\nemails')
  const r = receipt({ name: 'Test Person', passId: 'SCD-TESTTESTTE', tier: 'basic', homeTrack: 'ai' })
  const text = `${r.subject}\n${r.text}\n${r.html}`.toLowerCase()
  for (const w of RECEIPT_FORBIDDEN_WORDS) assert.ok(!new RegExp(`\\b${w}\\b`).test(text), `email 1 contains "${w}"`)
  ok(`email 1 contains none of: ${RECEIPT_FORBIDDEN_WORDS.join(', ')}`)

  const rj = rejection({ name: 'Test Person', passId: 'SCD-TESTTESTTE', tier: 'basic', homeTrack: 'ai' }, '123456789012', 'not found')
  assert.ok(!/\/pass\//.test(rj.text) && !/\/pass\//.test(rj.html), 'rejection email contains a pass link')
  assert.ok(rj.text.includes('123456789012'), 'rejection email quotes the UTR')
  ok('rejection email quotes the UTR and contains no pass link')

  // Session release: twice sends once each; interrupted halfway then re-run sends once each in total.
  const vs = await Promise.all([1, 2, 3, 4].map((n) => seedIn('VERIFIED', { email: `release${n}-${Date.now()}@scd-test.example` })))
  const emailsOf = vs.map((v) => v.email)
  let calls = 0
  const crashing: typeof send.sendEmail = async (mail) => {
    calls++
    if (calls === 3) throw new Error('simulated crash halfway through the release run')
    return send.sendEmail(mail)
  }
  const first = await sendSessionsLive(crashing)
  assert.ok(first.failed >= 1, 'the interrupted run reports a failure')
  const second = await sendSessionsLive()
  const third = await sendSessionsLive()
  assert.equal(third.sent, 0, 'a third run sends nothing')
  for (const e of emailsOf) assert.equal(sends(e), 1, `${e} got ${sends(e)} copies of email 3`)
  ok(`session release interrupted at the third send and re-run: every attendee got exactly one email 3 (runs: ${first.sent}+${second.sent}+${third.sent})`)
}

/* ---- sessions (Amendment 2 section 6) ---------------------------------------- */

async function sessions(): Promise<void> {
  console.log('\nsessions')
  const v = await seedIn('VERIFIED', { tier: 'basic', homeTrack: 'ai' })
  const outside = validatePicks(v, { ...picksAll('ai'), s2: 's2-cloud' })
  assert.equal(outside.ok, false, 'Regular picking a cloud session is refused')
  ok('a pick outside the tier allowance is refused server side (Regular, cloud session)')

  const dup = validatePicks({ tier: 'vip', homeTrack: 'ai' }, { s1: 's1-ai', s2: 's1-cloud', s3: 's3-ai', s4: 's4-ai' })
  assert.equal(dup.ok, false, 'a slot 1 session under slot 2 is refused')
  ok('two sessions from the same slot are refused')

  const missing = validatePicks({ tier: 'vip', homeTrack: 'ai' }, { s1: 's1-ai', s2: 's2-ai', s3: 's3-ai' })
  assert.equal(missing.ok, false, 'a missing slot is refused')
  ok('a submission missing a slot is refused')

  const premium = validatePicks({ tier: 'premium', homeTrack: 'ai' }, { s1: 's1-ai', s2: 's2-cloud', s3: 's3-career', s4: 's4-ai' })
  assert.equal(premium.ok, false, 'Premium drawing from two other tracks is refused')
  const premiumOk = validatePicks({ tier: 'premium', homeTrack: 'ai' }, { s1: 's1-ai', s2: 's2-cloud', s3: 's3-cloud', s4: 's4-ai' })
  assert.equal(premiumOk.ok, true, 'Premium drawing from home plus one other is allowed')
  ok('Premium: home plus one other track allowed, home plus two others refused')

  // Normalisation.
  const canonical = 'SCD-K4M7PQR29T'
  for (const f of ['scd k4m7pqr29t', 'SCDK4M7PQR29T', ' scd-k4m7-pqr29t ', canonical]) assert.equal(normalisePassId(f), canonical)
  assert.equal(normalisePassId('SCD-K4M7PQR29I'), null, 'I is not in the alphabet')
  ok('lowercase, spaced, unhyphenated and canonical forms all normalise to one id')

  // Second submission after SESSIONS_SELECTED claims nothing.
  const chosen = await seedIn('VERIFIED', { tier: 'vip', homeTrack: 'career' })
  const list = pickList(picksAll('career'))
  if (!list.ok) throw new Error(list.message)
  const before = await Promise.all(list.picks.map((p) => session(p.sessionId)))
  const first = await selectSessions(chosen.passId, list.picks)
  assert.equal(first.ok, true, 'first selection saved')
  const again = await selectSessions(chosen.passId, list.picks)
  assert.deepEqual(again, { ok: false, reason: 'wrong-state' })
  const after = await Promise.all(list.picks.map((p) => session(p.sessionId)))
  after.forEach((s, i) => assert.equal(s.seatsTaken, before[i]!.seatsTaken + 1, `${s.sessionId} moved by exactly one`))
  assert.equal((await getAttendeeWithSeats(chosen.passId)).seats.length, 4)
  ok('a second submission from SESSIONS_SELECTED claims no further seats')

  // Admin change keeps total seats constant across the two affected sessions.
  const s2c = await session('s2-career')
  const s2a = await session('s2-ai')
  const change = await changeSelection(chosen.passId, 'test@admin', { ...picksAll('career'), s2: 's2-ai' })
  assert.deepEqual(change, { ok: true, released: 1, claimed: 1 })
  const s2c2 = await session('s2-career')
  const s2a2 = await session('s2-ai')
  assert.equal(s2c2.seatsTaken + s2a2.seatsTaken, s2c.seatsTaken + s2a.seatsTaken, 'total across the two sessions unchanged')
  assert.equal(s2c2.seatsTaken, s2c.seatsTaken - 1)
  assert.equal(s2a2.seatsTaken, s2a.seatsTaken + 1)
  ok('admin change of one slot: released one, claimed one, total across both sessions unchanged')

  // Verify by provider only from AWAITING_PAYMENT, and only for the recorded amount.
  const aw = await seedIn('AWAITING_PAYMENT')
  assert.equal((await verifyByProvider(aw.passId, 'pay_x', 1)).ok, false, 'wrong amount refused')
  assert.equal((await verifyByProvider(aw.passId, 'pay_x', 39900)).ok, true)
  assert.equal((await verifyByProvider(aw.passId, 'pay_x', 39900)).ok, false, 'replay refused')
  ok('razorpay capture: AWAITING_PAYMENT to VERIFIED once, wrong amount and replays refused')

  // A rejection then a resubmission keeps the record and goes back to the queue.
  const pend = await seedIn('PENDING_VERIFICATION')
  const rj = await adminReject(pend.passId, 'test@admin', 'no match')
  assert.equal(rj.ok, true)
  assert.equal((await getAttendee(pend.passId))?.state, 'REJECTED')
  const resub = await submitUtr(pend.passId, pend.utr!, pend.screenshotKey!)
  assert.equal(resub.ok, true, 'the same UTR may be resubmitted by the same pass')
  assert.equal((await getAttendee(pend.passId))?.state, 'PENDING_VERIFICATION')
  const other = await seedIn('AWAITING_PAYMENT')
  const stolen = await submitUtr(other.passId, pend.utr!, `screenshots/${other.passId}/t.jpg`)
  assert.deepEqual(stolen, { ok: false, reason: 'utr-used' })
  assert.equal((await getAttendee(other.passId))?.state, 'AWAITING_PAYMENT', 'the second pass did not move')
  ok('reject then resubmit: same record, back to PENDING_VERIFICATION; the same UTR from another pass is refused by the table')
}

/* ---- HTTP (needs the server) ------------------------------------------------ */

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
  assert.equal(unknown.headers.get('location'), `${BASE}/pass?notfound=1`)
  ok(`unknown id and PENDING_VERIFICATION id: byte-identical ${unknown.status} responses (${ub.byteLength} bytes, same headers)`)

  const ver = await seedIn('VERIFIED')
  const bare = ver.passId.slice(4)
  for (const f of [ver.passId.toLowerCase(), `scd ${bare.toLowerCase()}`, `SCD${bare}`, `scd-${bare.slice(0, 4)}-${bare.slice(4)}`]) {
    const r = await form(f)
    assert.equal(r.status, 303)
    assert.equal(r.headers.get('location'), `${BASE}/pass/${ver.passId}`, `${JSON.stringify(f)} did not resolve`)
  }
  ok('lowercase, spaced, unhyphenated and re-hyphenated forms of a valid id all resolve to the pass')

  const page = await fetch(`${BASE}/pass/${pend.passId}`)
  const page404 = await fetch(`${BASE}/pass/SCD-ZZZZZZZZZZ`)
  assert.equal(page.status, 404)
  assert.equal(page404.status, 404)
  const html = await page.text()
  assert.ok(!html.includes(pend.email) && !html.includes(pend.utr!), 'the 404 leaks the record')
  ok('the pass page for a PENDING_VERIFICATION id is a 404 that names nothing')

  // Non-admin screenshot URL: refused, and no email address anywhere in the bytes.
  const shot = await fetch(`${BASE}/admin/screenshot/${pend.passId}`, { redirect: 'manual' })
  const body = await shot.text()
  assert.equal(shot.status, 403)
  assert.ok(!/@/.test(body), 'refused response contains an @')
  assert.ok(!body.includes(pend.passId), 'refused response contains the pass id')
  ok(`non-admin screenshot request: ${shot.status}, ${body.length} byte body with no address and no id`)

  // Selection route: allowance bypass by direct POST, wrong slot, missing slot, then a real claim.
  const reg = await seedIn('VERIFIED', { tier: 'basic', homeTrack: 'ai' })
  const post = (passId: string, picks: Record<string, string>) =>
    fetch(`${BASE}/api/pass/${passId}/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ picks }) })
  let r = await post(reg.passId, { ...picksAll('ai'), s2: 's2-cloud' })
  assert.equal(r.status, 400)
  r = await post(reg.passId, { s1: 's1-ai', s2: 's1-ai', s3: 's3-ai', s4: 's4-ai' })
  assert.equal(r.status, 400)
  r = await post(reg.passId, { s1: 's1-ai', s2: 's2-ai', s3: 's3-ai' })
  assert.equal(r.status, 400)
  ok('direct POSTs outside the allowance, with a wrong-slot session, and with a missing slot are all 400')

  await setFree('s3-ai', 0)
  r = await post(reg.passId, picksAll('ai'))
  const filledBody = (await r.json()) as { filled?: string; message?: string; sessions?: unknown[] }
  assert.equal(r.status, 409)
  assert.equal(filledBody.filled, 's3-ai')
  assert.equal(filledBody.message, 'That session just filled up, please pick another.')
  assert.ok(Array.isArray(filledBody.sessions) && filledBody.sessions.length === 12, 'fresh counts returned')
  assert.equal((await getAttendeeWithSeats(reg.passId)).seats.length, 0, 'nothing claimed')
  await setFree('s3-ai', 3)
  r = await post(reg.passId, picksAll('ai'))
  assert.equal(r.status, 200)
  assert.equal((await getAttendee(reg.passId))?.state, 'SESSIONS_SELECTED')
  r = await post(reg.passId, picksAll('ai'))
  assert.equal(r.status, 404, 'a second submission finds no pass waiting for choices')
  ok('a full session answers 409 naming it with fresh counts and no partial claim; a free one claims and moves the state; a repeat is refused')
}

/* ---- run ------------------------------------------------------------------ */

async function main(): Promise<void> {
  try {
    await stateMachine()
    await trackCounter()
    await emails()
    await sessions()
    await http()
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
