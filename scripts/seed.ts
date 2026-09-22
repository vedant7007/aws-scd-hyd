/**
 * Seeds the config item, the 12 sessions, the 3 track counters and 50 fake
 * attendees spread across the six lifecycle states.
 *
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<table> npm run seed
 *
 * Idempotent. Re-running rewrites the same pass ids, rebuilds every seat
 * count and track counter from what it writes, and clears anything an older
 * model left under the seeded keys. It refuses a table whose name looks like
 * production.
 *
 * The model has three TODO(vedant) holes: which room each track runs in, the
 * sellable capacity of each session, and slot times. Content leaves them unset
 * and every surface renders that. To exercise registration and seat claiming
 * against the sandbox anyway, SEED_TEST_MODEL=1 assigns rooms and sets every
 * session's sellable count to what the seed holds plus a few free seats, and
 * says so loudly. Never used for real data.
 */
import { createHmac } from 'node:crypto'
import { BatchWriteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassId, PASS_ALPHABET, PASS_LENGTH } from '../src/lib/db/keys'
import { YEARS_OF_STUDY, type Attendee, type EventConfig, type FoodPreference, type RegistrationState, type Room, type Seat, type Session, type Tier, type Track, type TrackCounter } from '../src/lib/db/types'
import { registrationOpen, roomForTrack, rooms, sessionsReleased, slots } from '../src/content/event'
import { EARLY_BIRD_TOTAL, passes, tracksAllowedFor } from '../src/content/passes'
import { holdMinutes } from '../src/content/payment'
import { sessionSpecs } from '../src/content/sessions'
import { tracks } from '../src/content/tracks'
import { ensureEarlyBirdCounter } from '../src/lib/registration/state'

const ATTENDEE_COUNT = 50
const TEST_MODEL = process.env.SEED_TEST_MODEL === '1'
/** Free seats left in every session under the test model. Small on purpose, so "full" is reachable in a test with a handful of picks. */
const TEST_FREE = Number(process.env.SEED_TEST_FREE ?? 3)
/** Free places left on every track counter under the test model. */
const TEST_TRACK_FREE = Number(process.env.SEED_TEST_TRACK_FREE ?? 4)

/**
 * Seed pass ids are derived, not random, so re-seeding hands back the same
 * ids and a pass URL you bookmarked yesterday still opens today. Same
 * alphabet and rejection sampling as the real generator, just from an HMAC
 * stream instead of randomBytes. Fake data only; real attendees get
 * newPassId, and nothing here is ever used for them.
 */
const SEED_SECRET = 'aws-scd-hyd-seed-v2'
const ACCEPT_BELOW = Math.floor(256 / PASS_ALPHABET.length) * PASS_ALPHABET.length
function seedPassId(n: number): string {
  let out = ''
  for (let block = 0; out.length < PASS_LENGTH; block++) {
    for (const b of createHmac('sha256', SEED_SECRET).update(`${n}:${block}`).digest()) {
      if (b >= ACCEPT_BELOW) continue
      out += PASS_ALPHABET[b % PASS_ALPHABET.length]
      if (out.length === PASS_LENGTH) break
    }
  }
  return `SCD-${out}`
}

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kabir', 'Meera', 'Arjun', 'Sana', 'Vihaan', 'Ira']
const LAST = ['Reddy', 'Rao', 'Sharma', 'Naidu', 'Iyer', 'Khan', 'Gupta', 'Menon', 'Das', 'Verma']
const COLLEGES = ['VJIT', 'CBIT', 'JNTUH', 'Vasavi', 'MGIT', 'CVR', 'GRIET']
const TIERS: Tier[] = ['basic', 'premium', 'ultra', 'vip']
const FOODS: FoodPreference[] = ['veg', 'nonveg']
const TRACKS: Track[] = tracks.map((t) => t.id)
/** Weighted towards the states an organiser looks at most. */
const STATES: RegistrationState[] = [
  'SESSIONS_SELECTED', 'SESSIONS_SELECTED', 'SESSIONS_SELECTED', 'VERIFIED', 'VERIFIED',
  'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'AWAITING_PAYMENT', 'REJECTED', 'ABANDONED',
]

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!

/** Test only: three track rooms in listed order, the buffer room never. */
const testAssignment = (): Partial<Record<Track, string>> => {
  const trackRooms = rooms.filter((r) => r.role === 'track')
  return Object.fromEntries(TRACKS.map((t, i) => [t, trackRooms[i]!.id])) as Partial<Record<Track, string>>
}
// Content now carries the provisional assignment; the test model only invents one while content has none.
const assignment = TEST_MODEL && Object.keys(roomForTrack).length === 0 ? testAssignment() : roomForTrack

function buildConfig(): EventConfig {
  return { ...keys.config(), rooms, slots, roomForTrack: assignment, registrationOpen, sessionsReleased: TEST_MODEL ? true : sessionsReleased }
}

/** The four picks of a selected attendee: one per slot, drawn from the tracks the tier allows, rotated so every session is used. */
function picksFor(tier: Tier, home: Track, i: number): Track[] {
  const allowed = tracksAllowedFor(tier)
  const pool = allowed >= TRACKS.length ? TRACKS : allowed === 1 ? [home] : [home, pick(TRACKS.filter((t) => t !== home), i)]
  return slots.map((_, k) => pick(pool, i + k))
}

function buildAttendees(createdAt: string): { attendees: Attendee[]; seats: Seat[] } {
  const attendees: Attendee[] = []
  const seats: Seat[] = []
  for (let i = 0; i < ATTENDEE_COUNT; i++) {
    const passId = seedPassId(i + 1)
    const name = `${pick(FIRST, i)} ${pick(LAST, i * 3)}`
    const tier = pick(TIERS, i)
    const homeTrack = pick(TRACKS, i)
    const state = pick(STATES, i)
    const utr = String(100000000000 + i * 7919).slice(0, 12)
    const a: Attendee = {
      ...keys.attendee(passId),
      ...gsi1.attendeeByPass(passId),
      passId,
      name,
      email: `${name.replace(' ', '.').toLowerCase()}.${i + 1}@example.test`,
      phone: `+9190000${String(10000 + i).slice(-5)}`,
      college: pick(COLLEGES, i),
      tier,
      homeTrack,
      foodPreference: pick(FOODS, i),
      yearOfStudy: pick(YEARS_OF_STUDY, i),
      over18: true,
      state,
      paymentMode: 'manual',
      amountPaise: passes.find((p) => p.id === tier)?.pricePaise ?? 0,
      source: 'manual',
      createdAt,
      // Fake people are never emailed. Marked as sent so they never read as owed.
      receiptSentAt: createdAt,
      confirmationSentAt: createdAt,
    }
    if (state === 'AWAITING_PAYMENT') a.holdUntil = new Date(Date.now() + holdMinutes * 60_000).toISOString()
    if (state !== 'AWAITING_PAYMENT' && state !== 'ABANDONED') {
      a.utr = utr
      a.utrSubmittedAt = createdAt
      a.screenshotKey = `screenshots/${passId}/seed.jpg`
    }
    if (state === 'VERIFIED' || state === 'SESSIONS_SELECTED') {
      a.verifiedBy = 'seed@example.test'
      a.verifiedAt = createdAt
      a.paidAt = createdAt
      a.paymentId = `UTR:${utr}`
    }
    if (state === 'REJECTED') {
      a.rejectionReason = 'No payment with this UTR in the statement'
      a.verifiedBy = 'seed@example.test'
      a.verifiedAt = createdAt
    }
    if (state === 'SESSIONS_SELECTED') {
      a.sessionsSelectedAt = createdAt
      a.passReadySentAt = createdAt
      picksFor(tier, homeTrack, i).forEach((track, k) => {
        const slot = slots[k]!
        const sessionId = `${slot.id}-${track}`
        seats.push({ ...keys.seat(passId, sessionId), passId, sessionId, slotId: slot.id, track, createdAt })
      })
    }
    attendees.push(a)
  }
  return { attendees, seats }
}

/** 12 sessions from content, rooms from the (test) assignment, seat counts from the seats written alongside. */
function buildSessions(seats: Seat[]): Session[] {
  const taken = new Map<string, number>()
  for (const s of seats) taken.set(s.sessionId, (taken.get(s.sessionId) ?? 0) + 1)
  const roomOf = (track: Track): Room | undefined => rooms.find((r) => r.id === assignment[track])
  return sessionSpecs().map((spec) => {
    const room = roomOf(spec.track)
    const physical = room?.physicalCapacity ?? null
    const held = taken.get(spec.sessionId) ?? 0
    const sellable = TEST_MODEL && physical !== null ? Math.min(held + TEST_FREE, physical) : spec.sellableCapacity
    return {
      ...keys.session(spec.sessionId),
      ...gsi1.sessionBySlot(spec.slotId, spec.sessionId),
      ...spec,
      roomId: room?.id ?? null,
      physicalCapacity: physical,
      sellableCapacity: sellable,
      seatsTaken: held,
    } satisfies Session
  })
}

/**
 * Amendment 1 section 2. One counter per track: registrations that hold a
 * place (every state but ABANDONED), against the sellable seats of the
 * track's room. Under the test model the ceiling is what is held plus a few.
 */
function buildCounters(attendees: Attendee[], sessions: Session[]): TrackCounter[] {
  return TRACKS.map((track) => {
    const registered = attendees.filter((a) => a.homeTrack === track && a.state !== 'ABANDONED').length
    const sellable = sessions.filter((s) => s.track === track).map((s) => s.sellableCapacity)
    const fromContent = sellable.every((n) => n !== null) ? Math.min(...(sellable as number[])) : null
    const ceiling = TEST_MODEL ? registered + TEST_TRACK_FREE : fromContent
    return { ...keys.trackCounter(track), track, registered, ceiling }
  })
}

/** DynamoDB caps BatchWriteItem at 25 items and can return some unprocessed. */
async function batch(requests: Record<string, unknown>[]): Promise<void> {
  const table = tableName()
  for (let i = 0; i < requests.length; i += 25) {
    let chunk = requests.slice(i, i + 25)
    for (let attempt = 0; chunk.length > 0; attempt++) {
      if (attempt > 8) throw new Error(`gave up on ${chunk.length} unprocessed items`)
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: chunk } }))
      const left = res.UnprocessedItems?.[table] ?? []
      if (left.length === 0) break
      chunk = left as typeof chunk
      await new Promise((r) => setTimeout(r, 2 ** attempt * 50))
    }
  }
}
const put = (items: Record<string, unknown>[]) => batch(items.map((Item) => ({ PutRequest: { Item } })))
const del = (items: { PK: string; SK: string }[]) => batch(items.map(({ PK, SK }) => ({ DeleteRequest: { Key: { PK, SK } } })))

/**
 * Anything an older model left behind: sessions content no longer describes,
 * every non-profile item under a seeded attendee, old-model seeded attendees
 * (SEED-nnn refs), and UTR claims from previous seed runs. Real attendees
 * are never touched.
 */
async function clearStale(keepSessions: Set<string>, seededIds: string[]): Promise<void> {
  const table = tableName()
  const stale: { PK: string; SK: string }[] = []

  let cursor: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: '(begins_with(PK, :s) AND SK = :meta) OR begins_with(PK, :old) OR begins_with(PK, :utr)',
        ExpressionAttributeValues: { ':s': 'SESSION#', ':meta': 'META', ':old': 'ATT#SEED-', ':utr': 'UTR#1000' },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: cursor,
      }),
    )
    for (const item of (page.Items ?? []) as { PK: string; SK: string }[]) {
      if (item.PK.startsWith('SESSION#') && keepSessions.has(item.PK)) continue
      stale.push(item)
    }
    cursor = page.LastEvaluatedKey
  } while (cursor)

  for (const passId of seededIds) {
    const page = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': keys.attendee(passId).PK },
        ProjectionExpression: 'PK, SK',
      }),
    )
    for (const item of (page.Items ?? []) as { PK: string; SK: string }[]) if (item.SK !== 'PROFILE') stale.push(item)
  }

  if (stale.length) await del(stale)
  console.log(`  cleared    ${stale.length} stale item(s)`)
}

function selfCheck(sessions: Session[], attendees: Attendee[], seats: Seat[], counters: TrackCounter[]): void {
  // The real generator must stay random and well shaped.
  const re = new RegExp(`^SCD-[${PASS_ALPHABET}]{${PASS_LENGTH}}$`)
  const real = Array.from({ length: 500 }, newPassId)
  if (!real.every((id) => re.test(id))) throw new Error('newPassId produced an id outside the alphabet')
  if (new Set(real).size !== 500) throw new Error('pass ids collided')
  // The seed generator must be the same shape but stable across runs.
  if (!re.test(seedPassId(1)) || seedPassId(1) !== seedPassId(1) || seedPassId(1) === seedPassId(2)) throw new Error('seed pass id is not stable and distinct')

  if (sessions.length !== tracks.length * slots.length) throw new Error(`expected ${tracks.length * slots.length} sessions, built ${sessions.length}`)
  const buffer = rooms.filter((r) => r.role === 'buffer').map((r) => r.id)
  if (sessions.some((s) => s.roomId && buffer.includes(s.roomId))) throw new Error('a session was placed in the buffer room')
  for (const s of sessions) {
    if (s.sellableCapacity !== null && (s.physicalCapacity === null || s.sellableCapacity > s.physicalCapacity)) throw new Error(`${s.sessionId}: sellable exceeds physical`)
  }

  // Seats: only selected attendees hold any, exactly one per slot, inside the tier's tracks.
  for (const a of attendees) {
    const mine = seats.filter((s) => s.passId === a.passId)
    const expected = a.state === 'SESSIONS_SELECTED' ? slots.length : 0
    if (mine.length !== expected) throw new Error(`${a.passId} (${a.state}) holds ${mine.length} seats, expected ${expected}`)
    if (new Set(mine.map((s) => s.slotId)).size !== mine.length) throw new Error(`${a.passId} holds two seats in one slot`)
    const others = new Set(mine.map((s) => s.track).filter((t) => t !== a.homeTrack))
    if (others.size > tracksAllowedFor(a.tier) - 1) throw new Error(`${a.passId} picks outside its allowance`)
  }
  const total = sessions.reduce((n, s) => n + s.seatsTaken, 0)
  if (total !== seats.length) throw new Error(`seatsTaken sums to ${total}, seats written ${seats.length}`)
  for (const c of counters) if (c.ceiling !== null && c.registered > c.ceiling) throw new Error(`${c.track} counter over its ceiling`)
  if (new Set(attendees.map((a) => a.GSI1PK)).size !== attendees.length) throw new Error('duplicate pass id')
}

async function main(): Promise<void> {
  const table = tableName()
  if (/prod/i.test(table)) throw new Error(`refusing to seed a table named ${table}`)

  const createdAt = new Date().toISOString()
  const { attendees, seats } = buildAttendees(createdAt)
  const sessions = buildSessions(seats)
  const counters = buildCounters(attendees, sessions)
  selfCheck(sessions, attendees, seats, counters)

  if (TEST_MODEL) {
    console.log(`TEST MODEL: rooms ${JSON.stringify(assignment)}, ${TEST_FREE} free seat(s) per session, ${TEST_TRACK_FREE} free place(s) per track, sessions released. Sandbox only.`)
  }

  await clearStale(new Set(sessions.map((s) => s.PK)), attendees.map((a) => a.passId))
  const utrClaims = attendees.filter((a) => a.utr).map((a) => ({ ...keys.utr(a.utr!), utr: a.utr!, passId: a.passId, submittedAt: createdAt }))
  await put([buildConfig(), ...sessions, ...counters, ...attendees, ...seats, ...utrClaims])
  // The early bird pool, created if absent and never reset by a reseed: the
  // count of places already given away is a fact about real registrations.
  await ensureEarlyBirdCounter()

  const byState = Object.fromEntries(STATES.map((s) => [s, attendees.filter((a) => a.state === s).length]))
  console.log(`seeded ${table}`)
  console.log(`  config     1 item, ${rooms.length} rooms (${rooms.filter((r) => r.role === 'buffer').length} buffer), ${slots.length} slots`)
  console.log(`  sessions   ${sessions.length}, counters ${counters.length}, early bird pool of ${EARLY_BIRD_TOTAL} ensured`)
  console.log(`  attendees  ${attendees.length} ${JSON.stringify(byState)}, holding ${seats.length} seats`)
  const sel = attendees.find((a) => a.state === 'SESSIONS_SELECTED')!
  const ver = attendees.find((a) => a.state === 'VERIFIED')!
  console.log(`\nsample pass (selected): /pass/${sel.passId}\nsample pass (verified): /pass/${ver.passId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
