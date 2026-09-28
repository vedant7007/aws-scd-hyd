/**
 * Seeds the config item, the seven session counters (five technical
 * sessions, two workshops) and 50 fake attendees spread across the five
 * lifecycle states.
 *
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<table> npm run seed
 *
 * Idempotent. Re-running rewrites the same pass ids, rebuilds every seat
 * count from what it writes, and clears anything an older model left under
 * the seeded keys. It refuses a table whose name looks like production.
 *
 * Seat counts per session are TODO(vedant): content leaves them unset and
 * nothing sells until an admin sizes each session in settings. To exercise
 * holds against the sandbox anyway, SEED_TEST_MODEL=1 sets every session to
 * what the seed holds plus a few free seats, and says so loudly. Never used
 * for real data.
 */
import { createHmac } from 'node:crypto'
import { BatchWriteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassId, PASS_ALPHABET, PASS_LENGTH } from '../src/lib/db/keys'
import type { Attendee, EventConfig, RegistrationState, Session, Tier } from '../src/lib/db/types'
import { registrationOpen } from '../src/content/event'
import { passes } from '../src/content/passes'
import { holdMinutes } from '../src/content/payment'
import { YEARS, hasWorkshop, programSessions, technicalSessions, workshops } from '../src/content/program'
import { seatsOf } from '../src/lib/registration/state'

const ATTENDEE_COUNT = 50
const TEST_MODEL = process.env.SEED_TEST_MODEL === '1'
/** Free seats left in every session under the test model. Small on purpose, so "full" is reachable in a test. */
const TEST_FREE = Number(process.env.SEED_TEST_FREE ?? 3)

/**
 * Seed pass ids are derived, not random, so re-seeding hands back the same
 * ids and a pass URL you bookmarked yesterday still opens today. Same
 * alphabet and rejection sampling as the real generator, just from an HMAC
 * stream instead of randomBytes. Fake data only.
 */
const SEED_SECRET = 'aws-scd-hyd-seed-v3'
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
const BRANCHES = ['CSE', 'IT', 'ECE', 'CSE (AI & ML)', 'EEE']
const TIERS: Tier[] = ['basic', 'premium', 'ultra', 'vip']
/** Weighted towards the states an organiser looks at most. */
const STATES: RegistrationState[] = [
  'VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'PENDING_VERIFICATION',
  'PENDING_VERIFICATION', 'PENDING_VERIFICATION', 'AWAITING_PAYMENT', 'REJECTED', 'ABANDONED',
]

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!

function buildAttendees(createdAt: string): Attendee[] {
  return Array.from({ length: ATTENDEE_COUNT }, (_, i) => {
    const passId = seedPassId(i + 1)
    const firstName = pick(FIRST, i)
    const lastName = pick(LAST, i * 3)
    const tier = pick(TIERS, i)
    const state = pick(STATES, i)
    const utr = `SEED${String(100000000000 + i * 7919)}`
    const a: Attendee = {
      ...keys.attendee(passId),
      ...gsi1.attendeeByPass(passId),
      passId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: `${firstName}.${lastName}.${i + 1}@example.test`.toLowerCase(),
      phone: `+9190000${String(10000 + i).slice(-5)}`,
      college: pick(COLLEGES, i),
      branch: pick(BRANCHES, i),
      rollNumber: `22SEED${String(1000 + i)}`,
      yearOfStudy: pick(YEARS, i),
      dateOfBirth: `200${i % 6}-0${(i % 9) + 1}-1${i % 10}`,
      tier,
      technicalSession: pick(technicalSessions, i).id,
      ...(hasWorkshop(tier) ? { workshop: pick(workshops, i).id } : {}),
      state,
      amountPaise: passes.find((p) => p.id === tier)?.pricePaise ?? 0,
      submissionKeyHash: 'seed',
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
    if (state === 'VERIFIED') {
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
    return a
  })
}

/** Every record but an abandoned one holds its seats. */
const holdsSeats = (a: Attendee) => a.state !== 'ABANDONED'

function buildSessions(attendees: Attendee[]): Session[] {
  const taken = new Map<string, number>()
  for (const a of attendees.filter(holdsSeats)) for (const s of seatsOf(a)) taken.set(s, (taken.get(s) ?? 0) + 1)
  return programSessions.map((s) => {
    const held = taken.get(s.id) ?? 0
    return { ...keys.session(s.id), sessionId: s.id, sellableCapacity: TEST_MODEL ? held + TEST_FREE : null, seatsTaken: held }
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
 * Anything an older model left behind: sessions, seats and counters content
 * no longer describes, the early bird pool, every non-profile item under a
 * seeded attendee, and UTR claims from previous seed runs. Real attendees
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
        FilterExpression:
          'begins_with(PK, :s) OR begins_with(PK, :track) OR begins_with(PK, :eb) OR begins_with(PK, :old) OR begins_with(PK, :utr1) OR begins_with(PK, :utr2)',
        ExpressionAttributeValues: { ':s': 'SESSION#', ':track': 'TRACK#', ':eb': 'EARLYBIRD', ':old': 'ATT#SEED-', ':utr1': 'UTR#1000', ':utr2': 'UTR#SEED' },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: cursor,
      }),
    )
    for (const item of (page.Items ?? []) as { PK: string; SK: string }[]) {
      if (item.SK === 'META' && keepSessions.has(item.PK)) continue
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
    for (const item of (page.Items ?? []) as { PK: string; SK: string }[]) if (item.SK !== keys.attendee(passId).SK) stale.push(item)
  }

  if (stale.length) await del(stale)
  console.log(`  cleared    ${stale.length} stale item(s)`)
}

function selfCheck(sessions: Session[], attendees: Attendee[]): void {
  // The real generator must stay random and well shaped.
  const re = new RegExp(`^SCD-[${PASS_ALPHABET}]{${PASS_LENGTH}}$`)
  const real = Array.from({ length: 500 }, newPassId)
  if (!real.every((id) => re.test(id))) throw new Error('newPassId produced an id outside the alphabet')
  if (new Set(real).size !== 500) throw new Error('pass ids collided')
  // The seed generator must be the same shape but stable across runs.
  if (!re.test(seedPassId(1)) || seedPassId(1) !== seedPassId(1) || seedPassId(1) === seedPassId(2)) throw new Error('seed pass id is not stable and distinct')

  if (sessions.length !== programSessions.length) throw new Error(`expected ${programSessions.length} sessions, built ${sessions.length}`)
  for (const a of attendees) {
    if (hasWorkshop(a.tier) !== Boolean(a.workshop)) throw new Error(`${a.passId}: workshop does not match ${a.tier}`)
  }
  const held = attendees.filter(holdsSeats).reduce((n, a) => n + seatsOf(a).length, 0)
  const total = sessions.reduce((n, s) => n + s.seatsTaken, 0)
  if (total !== held) throw new Error(`seatsTaken sums to ${total}, seats held ${held}`)
  if (new Set(attendees.map((a) => a.GSI1PK)).size !== attendees.length) throw new Error('duplicate pass id')
}

async function main(): Promise<void> {
  const table = tableName()
  if (/prod|main-branch/i.test(table)) throw new Error(`refusing to seed a table named ${table}`)

  const createdAt = new Date().toISOString()
  const attendees = buildAttendees(createdAt)
  const sessions = buildSessions(attendees)
  selfCheck(sessions, attendees)

  if (TEST_MODEL) console.log(`TEST MODEL: ${TEST_FREE} free seat(s) per session. Sandbox only.`)

  await clearStale(new Set(sessions.map((s) => s.PK)), attendees.map((a) => a.passId))
  const config: EventConfig = { ...keys.config(), registrationOpen }
  const utrClaims = attendees.filter((a) => a.utr).map((a) => ({ ...keys.utr(a.utr!), utr: a.utr!, passId: a.passId, submittedAt: createdAt }))
  await put([config, ...sessions, ...attendees, ...utrClaims])

  const byState = Object.fromEntries([...new Set(STATES)].map((s) => [s, attendees.filter((a) => a.state === s).length]))
  console.log(`seeded ${table}`)
  console.log(`  sessions   ${sessions.map((s) => `${s.sessionId}:${s.seatsTaken}/${s.sellableCapacity ?? '-'}`).join(' ')}`)
  console.log(`  attendees  ${attendees.length} ${JSON.stringify(byState)}`)
  console.log(`\nsample pass: /pass/${attendees.find((a) => a.state === 'VERIFIED')!.passId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
