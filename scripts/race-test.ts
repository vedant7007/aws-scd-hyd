/**
 * The acceptance test for SPEC.md section 9.
 *
 * Two genuinely concurrent claims on a session with exactly one seat. One must
 * win, one must be told the seat went, and seatsTaken must end at 1, not 2.
 *
 * Runs against the real sandbox table through the real HTTP route. Nothing here
 * is mocked, because the thing under test is a DynamoDB transaction and a mock
 * would only prove the mock works.
 *
 *   npm run dev            # in another shell
 *   npm run race-test
 */
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys } from '../src/lib/db/keys'
import { getAttendeeWithSelections } from '../src/lib/db/queries'
import type { Session } from '../src/lib/db/types'

const BASE = process.env.RACE_TEST_BASE_URL ?? 'http://localhost:3100'

/** Its own slot, so this fixture never shows up in a real attendee's picker. */
const SLOT_ID = 'race'
const SESSION_ID = 'race-one-seat'
const CONTENDERS = ['SEED-001', 'SEED-002']

const table = () => tableName()

async function resetFixture(): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...keys.session(SESSION_ID),
        ...gsi1.sessionBySlot(SLOT_ID, SESSION_ID),
        sessionId: SESSION_ID,
        title: 'Race test, one seat',
        speaker: 'Nobody',
        track: 'cloud',
        hallId: 'race',
        slotId: SLOT_ID,
        capacity: 1,
        seatsTaken: 0,
      } satisfies Session,
    }),
  )

  // Clear any selection either contender holds in this slot, from a prior run.
  for (const ticketRef of CONTENDERS) {
    await ddb.send(
      new DeleteCommand({ TableName: table(), Key: keys.selection(ticketRef, SLOT_ID) }),
    )
  }
}

async function seatsTaken(): Promise<number> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.session(SESSION_ID) }))
  return (res.Item as Session | undefined)?.seatsTaken ?? -1
}

type Attempt = {
  ticketRef: string
  status: number
  body: { ok?: boolean; code?: string; message?: string }
  startedAt: number
  finishedAt: number
}

async function claim(ticketRef: string, token: string): Promise<Attempt> {
  const startedAt = Date.now()
  const res = await fetch(`${BASE}/api/pass/${token}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slotId: SLOT_ID, sessionId: SESSION_ID }),
  })
  // Read as text first. A 500 with an empty body must surface as a failed
  // attempt, not as a JSON parse error that hides what the route did.
  const raw = await res.text()
  let body: Attempt['body'] = {}
  try {
    body = raw ? (JSON.parse(raw) as Attempt['body']) : { message: `empty body (${raw.length} bytes)` }
  } catch {
    body = { message: `unparseable body: ${raw.slice(0, 200)}` }
  }
  return { ticketRef, status: res.status, body, startedAt, finishedAt: Date.now() }
}

async function main(): Promise<void> {
  await resetFixture()

  const tokens: string[] = []
  for (const ticketRef of CONTENDERS) {
    const { attendee } = await getAttendeeWithSelections(ticketRef)
    if (!attendee) throw new Error(`${ticketRef} is not seeded, run npm run seed first`)
    tokens.push(attendee.passToken)
  }

  console.log(`before: seatsTaken=${await seatsTaken()} capacity=1`)

  // Both requests are dispatched before either resolves. Promise.all does not
  // await the first, so the two are in flight at the same time.
  const attempts = await Promise.all(CONTENDERS.map((ref, i) => claim(ref, tokens[i])))

  const overlapStart = Math.max(...attempts.map((a) => a.startedAt))
  const overlapEnd = Math.min(...attempts.map((a) => a.finishedAt))
  const overlapMs = overlapEnd - overlapStart

  for (const a of attempts) {
    console.log(`  ${a.ticketRef}: HTTP ${a.status} ${a.body.code ?? 'ok'} ${a.body.message ?? ''}`)
  }
  console.log(`  in flight together for ${overlapMs}ms`)

  const winners = attempts.filter((a) => a.status === 200 && a.body.ok === true)
  const losers = attempts.filter((a) => a.status === 409 && a.body.code === 'full')
  const after = await seatsTaken()

  const failures: string[] = []
  if (overlapMs <= 0) failures.push('the two requests did not actually overlap in flight')
  if (winners.length !== 1) failures.push(`expected exactly 1 winner, got ${winners.length}`)
  if (losers.length !== 1) failures.push(`expected exactly 1 loser with code "full", got ${losers.length}`)
  if (after !== 1) failures.push(`expected seatsTaken to be 1 afterwards, got ${after}`)

  console.log(`after:  seatsTaken=${after}`)

  if (failures.length > 0) {
    console.error('\nRACE TEST FAILED')
    failures.forEach((f) => console.error(`  ${f}`))
    process.exit(1)
  }
  console.log('\nRACE TEST PASSED: one winner, one told the seat went, seatsTaken=1')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
