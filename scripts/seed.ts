/**
 * Seeds the config item, the 12 sessions and 50 fake attendees holding seats.
 *
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<table> npm run seed
 *
 * Idempotent. Re-running rewrites the same ticket refs and rebuilds every
 * seat count from the seats it writes, and it clears anything an older model
 * left under the seeded keys. It refuses a table whose name looks like
 * production.
 *
 * The model has three TODO(vedant) holes: which room each track runs in, the
 * sellable capacity of each session, and slot times. Content leaves them unset
 * and every surface renders that. To exercise seat claiming against the
 * sandbox anyway, SEED_TEST_MODEL=1 assigns rooms and sets every session's
 * sellable count to what the seed holds plus a few free seats, and says so
 * loudly. Never used for real data.
 */
import { createHmac } from 'node:crypto'
import { BatchWriteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassToken, normaliseEmail } from '../src/lib/db/keys'
import type { Attendee, EventConfig, FoodPreference, Room, Seat, Session, Tier, Track } from '../src/lib/db/types'
import { registrationOpen, roomForTrack, rooms, sessionRefinementOpen, slots } from '../src/content/event'
import { tracksAllowedFor } from '../src/content/passes'
import { sessionSpecs } from '../src/content/sessions'
import { tracks } from '../src/content/tracks'

const ATTENDEE_COUNT = 50
const TEST_MODEL = process.env.SEED_TEST_MODEL === '1'
/** Free seats left in every session under the test model. Small on purpose, so "track full" is reachable in a test with a handful of registrations. */
const TEST_FREE = Number(process.env.SEED_TEST_FREE ?? 3)

/**
 * Seed pass tokens are derived, not random, so re-seeding hands back the same
 * links and a pass URL you bookmarked yesterday still opens today. This is for
 * fake data only. Real attendees get crypto.randomBytes through newPassToken in
 * settle, see SPEC.md section 7, and nothing here is ever used for them.
 */
const SEED_TOKEN_SECRET = 'aws-scd-hyd-seed-v1'

const seedPassToken = (ticketRef: string) =>
  createHmac('sha256', SEED_TOKEN_SECRET).update(ticketRef).digest().subarray(0, 12).toString('base64url')

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kabir', 'Meera', 'Arjun', 'Sana', 'Vihaan', 'Ira']
const LAST = ['Reddy', 'Rao', 'Sharma', 'Naidu', 'Iyer', 'Khan', 'Gupta', 'Menon', 'Das', 'Verma']
const COLLEGES = ['VJIT', 'CBIT', 'JNTUH', 'Vasavi', 'MGIT', 'CVR', 'GRIET']
const TIERS: Tier[] = ['basic', 'premium', 'ultra', 'vip']
const FOODS: FoodPreference[] = ['veg', 'nonveg', 'jain']
const TRACKS: Track[] = tracks.map((t) => t.id)

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!

/** Test only: three track rooms in listed order, the buffer room never. */
const testAssignment = (): Partial<Record<Track, string>> => {
  const trackRooms = rooms.filter((r) => r.role === 'track')
  return Object.fromEntries(TRACKS.map((t, i) => [t, trackRooms[i]!.id])) as Partial<Record<Track, string>>
}

const assignment = TEST_MODEL ? testAssignment() : roomForTrack

function buildConfig(): EventConfig {
  return { ...keys.config(), rooms, slots, roomForTrack: assignment, registrationOpen, sessionRefinementOpen }
}

/** The tracks a seeded attendee registered for: as many as the tier allows, rotated so every track is held. */
const tracksFor = (tier: Tier, i: number): Track[] =>
  Array.from({ length: tracksAllowedFor(tier) }, (_, k) => pick(TRACKS, i + k))

function buildAttendees(createdAt: string): { attendees: Attendee[]; seats: Seat[] } {
  const attendees: Attendee[] = []
  const seats: Seat[] = []
  for (let i = 0; i < ATTENDEE_COUNT; i++) {
    const ticketRef = `SEED-${String(i + 1).padStart(3, '0')}`
    const name = `${pick(FIRST, i)} ${pick(LAST, i * 3)}`
    const passToken = seedPassToken(ticketRef)
    const tier = pick(TIERS, i)
    const held = tracksFor(tier, i)
    attendees.push({
      ...keys.attendee(ticketRef),
      ...gsi1.attendeeByToken(passToken),
      ticketRef,
      passToken,
      name,
      email: normaliseEmail(`${name.replace(' ', '.')}.${i + 1}@example.test`),
      phone: `+9190000${String(10000 + i).slice(-5)}`,
      college: pick(COLLEGES, i),
      tier,
      tracks: held,
      foodPreference: pick(FOODS, i),
      paymentStatus: 'paid',
      paymentMode: 'manual',
      source: 'manual',
      createdAt,
      // Fake people are never emailed. Marked as sent so they never read as owed.
      confirmationSentAt: createdAt,
    } satisfies Attendee)
    for (const track of held) {
      for (const slot of slots) {
        const sessionId = `${slot.id}-${track}`
        seats.push({ ...keys.seat(ticketRef, sessionId), ticketRef, sessionId, slotId: slot.id, track, createdAt })
      }
    }
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
 * Anything an older model left behind: sessions with ids content no longer
 * describes, and every non-profile item under a seeded attendee (old slot
 * selections, seats from a previous run). Real attendees are never touched.
 */
async function clearStale(keep: Set<string>): Promise<void> {
  const table = tableName()
  const stale: { PK: string; SK: string }[] = []

  let cursor: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: 'begins_with(PK, :s) AND SK = :meta',
        ExpressionAttributeValues: { ':s': 'SESSION#', ':meta': 'META' },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: cursor,
      }),
    )
    for (const item of (page.Items ?? []) as { PK: string; SK: string }[]) if (!keep.has(item.PK)) stale.push(item)
    cursor = page.LastEvaluatedKey
  } while (cursor)

  for (let i = 0; i < ATTENDEE_COUNT; i++) {
    const pk = keys.attendee(`SEED-${String(i + 1).padStart(3, '0')}`).PK
    const page = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ProjectionExpression: 'PK, SK',
      }),
    )
    for (const item of (page.Items ?? []) as { PK: string; SK: string }[]) if (item.SK !== 'PROFILE') stale.push(item)
  }

  if (stale.length) await del(stale)
  console.log(`  cleared    ${stale.length} stale item(s)`)
}

function selfCheck(sessions: Session[], attendees: Attendee[], seats: Seat[]): void {
  // The real generator, used by settle, must stay random and well shaped.
  const token = newPassToken()
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) throw new Error(`pass token is not 16 url-safe chars: ${token}`)
  if (new Set(Array.from({ length: 500 }, newPassToken)).size !== 500) throw new Error('pass tokens collided')

  // The seed generator must be the same shape but stable across runs.
  const seeded = seedPassToken('SEED-001')
  if (!/^[A-Za-z0-9_-]{16}$/.test(seeded)) throw new Error(`seed token is not 16 url-safe chars: ${seeded}`)
  if (seedPassToken('SEED-001') !== seeded) throw new Error('seed token is not deterministic')
  if (seedPassToken('SEED-002') === seeded) throw new Error('seed token does not vary by ticket ref')

  // The model: 3 tracks x 4 slots, never the buffer room, both capacities coherent.
  if (sessions.length !== tracks.length * slots.length) throw new Error(`expected ${tracks.length * slots.length} sessions, built ${sessions.length}`)
  if (new Set(sessions.map((s) => s.PK)).size !== sessions.length) throw new Error('duplicate session key')
  const buffer = rooms.filter((r) => r.role === 'buffer').map((r) => r.id)
  if (sessions.some((s) => s.roomId && buffer.includes(s.roomId))) throw new Error('a session was placed in the buffer room')
  for (const s of sessions) {
    if (s.sellableCapacity !== null && (s.physicalCapacity === null || s.sellableCapacity > s.physicalCapacity)) {
      throw new Error(`${s.sessionId}: sellable ${s.sellableCapacity} exceeds physical ${s.physicalCapacity}`)
    }
  }

  // Seats: every attendee holds exactly 4 per track, all in its own tracks, and the counts add up.
  for (const a of attendees) {
    const mine = seats.filter((s) => s.ticketRef === a.ticketRef)
    if (mine.length !== a.tracks.length * slots.length) throw new Error(`${a.ticketRef} holds ${mine.length} seats for ${a.tracks.length} track(s)`)
    if (a.tracks.length > tracksAllowedFor(a.tier)) throw new Error(`${a.ticketRef} exceeds tracksAllowed`)
    if (mine.some((s) => !a.tracks.includes(s.track))) throw new Error(`${a.ticketRef} holds a seat outside its tracks`)
  }
  const total = sessions.reduce((n, s) => n + s.seatsTaken, 0)
  if (total !== seats.length) throw new Error(`seatsTaken sums to ${total}, seats written ${seats.length}`)
  if (new Set(attendees.map((a) => a.GSI1PK)).size !== attendees.length) throw new Error('duplicate pass token')
}

async function main(): Promise<void> {
  const table = tableName()
  if (/prod/i.test(table)) throw new Error(`refusing to seed a table named ${table}`)

  const createdAt = new Date().toISOString()
  const { attendees, seats } = buildAttendees(createdAt)
  const sessions = buildSessions(seats)
  selfCheck(sessions, attendees, seats)

  if (TEST_MODEL) {
    console.log(`TEST MODEL: rooms assigned ${JSON.stringify(assignment)}, every session left with ${TEST_FREE} free seat(s). Sandbox only.`)
  }

  await clearStale(new Set(sessions.map((s) => s.PK)))
  await put([buildConfig(), ...sessions, ...attendees, ...seats])

  console.log(`seeded ${table}`)
  console.log(`  config     1 item, ${rooms.length} rooms (${rooms.filter((r) => r.role === 'buffer').length} buffer), ${slots.length} slots`)
  console.log(`  sessions   ${sessions.length}`)
  console.log(`  attendees  ${attendees.length}, holding ${seats.length} seats`)
  console.log(`\nsample pass link: /pass/${attendees[0]!.passToken}  (${attendees[0]!.ticketRef})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
