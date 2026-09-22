/**
 * The acceptance test for SPEC.md section 9 and Amendment 2 section 6.
 *
 * One session is set to exactly one free seat, then two VERIFIED attendees
 * submit four picks that include it, genuinely concurrently. One must win
 * and hold all four seats; the other must be refused with the session named
 * and hold nothing; the session must end one seat higher, not two.
 *
 * Runs against the real sandbox table through selectSessions, the same
 * function the route calls, because the thing under test is a DynamoDB
 * transaction and a mock would only prove the mock works.
 *
 *   SEED_TEST_MODEL=1 npm run seed && npm run race-test
 */
import { GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { gsi1, keys, newPassId } from '../src/lib/db/keys'
import { getAttendeeWithSeats } from '../src/lib/db/queries'
import { releaseItems } from '../src/lib/db/seats'
import type { Attendee, Session } from '../src/lib/db/types'
import { selectSessions } from '../src/lib/registration/state'
import { slots } from '../src/content/event'

const table = () => tableName()
const CONTESTED = 's2-career'

async function session(id: string): Promise<Session> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.session(id) }))
  if (!res.Item) throw new Error(`${id} is not seeded. Run the seed with SEED_TEST_MODEL=1 first.`)
  return res.Item as Session
}

async function setFree(id: string, free: number): Promise<void> {
  const s = await session(id)
  await ddb.send(
    new UpdateCommand({
      TableName: table(),
      Key: keys.session(id),
      UpdateExpression: 'SET sellableCapacity = :cap',
      ExpressionAttributeValues: { ':cap': s.seatsTaken + free },
    }),
  )
}

/** A VERIFIED VIP, so every track is allowed and the picks are only about seats. */
async function contender(name: string): Promise<Attendee> {
  const passId = newPassId()
  const now = new Date().toISOString()
  const a: Attendee = {
    ...keys.attendee(passId),
    ...gsi1.attendeeByPass(passId),
    passId,
    name,
    email: `${name}@example.test`,
    phone: '+919000000000',
    college: 'Race',
    yearOfStudy: '3',
    over18: true,
    tier: 'vip',
    homeTrack: 'career',
    foodPreference: 'veg',
    state: 'VERIFIED',
    paymentMode: 'manual',
    amountPaise: 169900,
    source: 'manual',
    createdAt: now,
  }
  await ddb.send(new PutCommand({ TableName: table(), Item: a }))
  return a
}

async function cleanup(passId: string): Promise<void> {
  const { seats } = await getAttendeeWithSeats(passId)
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [{ Delete: { TableName: table(), Key: keys.attendee(passId) } }, ...releaseItems(seats)],
    }),
  )
}

async function main(): Promise<void> {
  const picks = slots.map((s) => ({ slotId: s.id, track: 'career' as const, sessionId: `${s.id}-career` }))
  for (const p of picks) await setFree(p.sessionId, p.sessionId === CONTESTED ? 1 : 5)
  const before = await session(CONTESTED)

  const [a, b] = await Promise.all([contender('race-a'), contender('race-b')])
  const [ra, rb] = await Promise.all([selectSessions(a.passId, picks), selectSessions(b.passId, picks)])

  const after = await session(CONTESTED)
  const results = [ra, rb]
  const winners = results.filter((r) => r.ok)
  const losers = results.filter((r) => !r.ok)
  const winner = winners[0]?.ok ? (winners[0] as { ok: true; attendee: Attendee }).attendee : null
  const held = winner ? (await getAttendeeWithSeats(winner.passId)).seats : []
  const loserId = losers[0] === ra ? a.passId : b.passId
  const loserHeld = losers.length ? (await getAttendeeWithSeats(loserId)).seats : []

  const problems: string[] = []
  if (winners.length !== 1) problems.push(`expected exactly one winner, got ${winners.length}`)
  if (losers.length !== 1) problems.push(`expected exactly one loser, got ${losers.length}`)
  const loser = losers[0]
  if (loser && !loser.ok && !(loser.reason === 'filled' && loser.sessionId === CONTESTED)) {
    problems.push(`loser was refused for ${JSON.stringify(loser)}, not filled on ${CONTESTED}`)
  }
  if (after.seatsTaken - before.seatsTaken !== 1) problems.push(`${CONTESTED} went from ${before.seatsTaken} to ${after.seatsTaken}, expected +1`)
  if (held.length !== slots.length) problems.push(`winner holds ${held.length} seats, expected ${slots.length}`)
  if (loserHeld.length !== 0) problems.push(`loser holds ${loserHeld.length} seats, expected 0 (partial claim!)`)
  if (winner && winner.state !== 'SESSIONS_SELECTED') problems.push(`winner is ${winner.state}, expected SESSIONS_SELECTED`)

  await cleanup(a.passId)
  await cleanup(b.passId)
  for (const p of picks) await setFree(p.sessionId, 3)

  if (problems.length) {
    console.error('RACE TEST FAILED\n  ' + problems.join('\n  '))
    process.exit(1)
  }
  console.log(
    `race test passed: one winner holding ${held.length} seats, one refused with "filled" on ${CONTESTED}, seatsTaken ${before.seatsTaken} -> ${after.seatsTaken}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
