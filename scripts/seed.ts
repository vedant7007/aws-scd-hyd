/**
 * Seeds a full session grid, the config item and 50 fake attendees.
 *
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<table> npm run seed
 *
 * Idempotent. Re-running overwrites the same ticket refs and resets seatsTaken,
 * so it is safe to run against a sandbox table as often as you like. It refuses
 * to touch a table whose name does not look like a sandbox table.
 */
import { createHmac } from 'node:crypto'
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassToken, normaliseEmail } from '../src/lib/db/keys'
import type { Attendee, FoodPreference, Session, Tier, Track } from '../src/lib/db/types'
import { halls, registrationOpen, slots } from '../src/content/event'

const ATTENDEE_COUNT = 50

/**
 * Seed pass tokens are derived, not random, so re-seeding hands back the same
 * links and a pass URL you bookmarked yesterday still opens today. This is for
 * fake data only. Real attendees get crypto.randomBytes through newPassToken in
 * the webhook, see SPEC.md section 7, and nothing here is ever used for them.
 *
 * Same shape as a real token: 12 bytes rendered as 16 url-safe characters.
 */
const SEED_TOKEN_SECRET = 'aws-scd-hyd-seed-v1'

const seedPassToken = (ticketRef: string) =>
  createHmac('sha256', SEED_TOKEN_SECRET).update(ticketRef).digest().subarray(0, 12).toString('base64url')

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kabir', 'Meera', 'Arjun', 'Sana', 'Vihaan', 'Ira']
const LAST = ['Reddy', 'Rao', 'Sharma', 'Naidu', 'Iyer', 'Khan', 'Gupta', 'Menon', 'Das', 'Verma']
const COLLEGES = ['VJIT', 'CBIT', 'JNTUH', 'Vasavi', 'MGIT', 'CVR', 'GRIET']
const TIERS: Tier[] = ['basic', 'premium', 'ultra', 'vip']
const FOODS: FoodPreference[] = ['veg', 'nonveg', 'jain']
const TRACKS: Track[] = ['ai', 'cloud', 'career']

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]

/** Grid is halls times slots, so it stays correct whether there are 3 halls or 4. */
function buildSessions(): Session[] {
  return slots.flatMap((slot, si) =>
    halls.map((hall, hi) => {
      const sessionId = `${slot.id}-${hall.id}`
      const track = pick(TRACKS, si + hi)
      return {
        ...keys.session(sessionId),
        ...gsi1.sessionBySlot(slot.id, sessionId),
        sessionId,
        title: `${slot.label} in ${hall.name}`,
        speaker: 'Announced soon',
        track,
        hallId: hall.id,
        slotId: slot.id,
        capacity: hall.capacity,
        seatsTaken: 0,
      } satisfies Session
    }),
  )
}

function buildAttendees(createdAt: string): Attendee[] {
  return Array.from({ length: ATTENDEE_COUNT }, (_, i) => {
    const ticketRef = `SEED-${String(i + 1).padStart(3, '0')}`
    const name = `${pick(FIRST, i)} ${pick(LAST, i * 3)}`
    const passToken = seedPassToken(ticketRef)
    return {
      ...keys.attendee(ticketRef),
      ...gsi1.attendeeByToken(passToken),
      ticketRef,
      passToken,
      name,
      email: normaliseEmail(`${name.replace(' ', '.')}.${i + 1}@example.test`),
      phone: `+9190000${String(10000 + i).slice(-5)}`,
      college: pick(COLLEGES, i),
      tier: pick(TIERS, i),
      foodPreference: pick(FOODS, i),
      paymentStatus: 'paid',
      source: 'manual',
      createdAt,
    } satisfies Attendee
  })
}

/** DynamoDB caps BatchWriteItem at 25 items and can return some unprocessed. */
async function batchPut(items: Record<string, unknown>[]): Promise<void> {
  const table = tableName()
  for (let i = 0; i < items.length; i += 25) {
    let requests = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }))
    for (let attempt = 0; requests.length > 0; attempt++) {
      if (attempt > 8) throw new Error(`gave up on ${requests.length} unprocessed items`)
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: requests } }))
      const left = res.UnprocessedItems?.[table] ?? []
      if (left.length === 0) break
      requests = left as typeof requests
      await new Promise((r) => setTimeout(r, 2 ** attempt * 50))
    }
  }
}

function selfCheck(): void {
  // The real generator, used by the webhook, must stay random and well shaped.
  const token = newPassToken()
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) throw new Error(`pass token is not 16 url-safe chars: ${token}`)
  if (new Set(Array.from({ length: 500 }, newPassToken)).size !== 500) throw new Error('pass tokens collided')

  // The seed generator must be the same shape but stable across runs.
  const seeded = seedPassToken('SEED-001')
  if (!/^[A-Za-z0-9_-]{16}$/.test(seeded)) throw new Error(`seed token is not 16 url-safe chars: ${seeded}`)
  if (seedPassToken('SEED-001') !== seeded) throw new Error('seed token is not deterministic')
  if (seedPassToken('SEED-002') === seeded) throw new Error('seed token does not vary by ticket ref')
  const sessions = buildSessions()
  if (sessions.length !== halls.length * slots.length) throw new Error('session grid is incomplete')
  if (new Set(sessions.map((s) => s.PK)).size !== sessions.length) throw new Error('duplicate session key')
  const attendees = buildAttendees(new Date().toISOString())
  if (new Set(attendees.map((a) => a.GSI1PK)).size !== attendees.length) throw new Error('duplicate pass token')
}

async function main(): Promise<void> {
  selfCheck()

  const table = tableName()
  if (/prod/i.test(table)) throw new Error(`refusing to seed a table named ${table}`)

  const createdAt = new Date().toISOString()
  const sessions = buildSessions()
  const attendees = buildAttendees(createdAt)

  await batchPut([
    { ...keys.config(), halls, slots, registrationOpen },
    ...sessions,
    ...attendees,
  ])

  console.log(`seeded ${table}`)
  console.log(`  config     1 item, ${halls.length} halls, ${slots.length} slots`)
  console.log(`  sessions   ${sessions.length}`)
  console.log(`  attendees  ${attendees.length}`)
  console.log(`\nsample pass link: /pass/${attendees[0].passToken}  (${attendees[0].ticketRef})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
