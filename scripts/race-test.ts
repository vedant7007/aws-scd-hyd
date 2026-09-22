/**
 * The acceptance test for SPEC.md section 9, reshaped for tracks.
 *
 * A track's four sessions are set to exactly one free seat each, then two
 * registrations for that track run genuinely concurrently. One must win and
 * hold all four seats, one must be told the track is full with nothing
 * written, and every session must end one seat higher, not two.
 *
 * Runs against the real sandbox table through createPendingAttendee, the same
 * function the checkout route calls, because the thing under test is a
 * DynamoDB transaction and a mock would only prove the mock works.
 *
 *   npm run race-test
 */
import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { keys, newTicketRef } from '../src/lib/db/keys'
import { getAttendeeWithSeats } from '../src/lib/db/queries'
import { releaseSeatItems } from '../src/lib/db/seats'
import type { Session, Track } from '../src/lib/db/types'
import { createPendingAttendee } from '../src/lib/db/writes'
import { sessionIdsForTrack } from '../src/content/sessions'

const TRACK: Track = 'career'
const table = () => tableName()

async function session(id: string): Promise<Session> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.session(id) }))
  if (!res.Item) throw new Error(`${id} is not seeded. Run the seed with SEED_TEST_MODEL=1 first.`)
  return res.Item as Session
}

/** Leave exactly one free seat in every session of the track. */
async function pinToOneFree(ids: string[]): Promise<void> {
  for (const id of ids) {
    const s = await session(id)
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: keys.session(id),
        UpdateExpression: 'SET sellableCapacity = :cap',
        ExpressionAttributeValues: { ':cap': s.seatsTaken + 1 },
      }),
    )
  }
}

async function register(name: string) {
  return createPendingAttendee(
    newTicketRef(),
    { name, email: `${name}@example.test`, phone: '+919000000000', college: 'Race', tier: 'basic', tracks: [TRACK], foodPreference: 'veg' },
    { mode: 'manual', amountPaise: 39900, holdUntil: new Date(Date.now() + 60_000).toISOString() },
  )
}

async function cleanup(ticketRef: string): Promise<void> {
  const { seats } = await getAttendeeWithSeats(ticketRef)
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [{ Delete: { TableName: table(), Key: keys.attendee(ticketRef) } }, ...releaseSeatItems(seats)],
    }),
  )
}

async function main(): Promise<void> {
  const ids = sessionIdsForTrack(TRACK)
  await pinToOneFree(ids)
  const before = await Promise.all(ids.map(session))

  const [a, b] = await Promise.all([register('race-a'), register('race-b')])
  const winners = [a, b].filter((r) => r.ok)
  const losers = [a, b].filter((r) => !r.ok)

  const after = await Promise.all(ids.map(session))
  const deltas = after.map((s, i) => s.seatsTaken - before[i]!.seatsTaken)

  const winner = winners[0]
  const held = winner?.ok ? (await getAttendeeWithSeats(winner.attendee.ticketRef)).seats : []

  const problems: string[] = []
  if (winners.length !== 1) problems.push(`expected exactly one winner, got ${winners.length}`)
  if (losers.length !== 1) problems.push(`expected exactly one loser, got ${losers.length}`)
  const loser = losers[0]
  if (loser && !loser.ok && !(loser.reason === 'track-full' && loser.track === TRACK)) problems.push(`loser was refused for ${loser.reason}, not track-full on ${TRACK}`)
  if (deltas.some((d) => d !== 1)) problems.push(`session deltas were ${deltas.join(',')}, expected 1,1,1,1`)
  if (held.length !== ids.length) problems.push(`winner holds ${held.length} seats, expected ${ids.length}`)
  if (held.some((s) => s.track !== TRACK)) problems.push('winner holds a seat outside the track')

  for (const w of winners) if (w.ok) await cleanup(w.attendee.ticketRef)
  // Put the free seat back for the next run.
  await pinToOneFree(ids)

  if (problems.length) {
    console.error('RACE TEST FAILED\n  ' + problems.join('\n  '))
    process.exit(1)
  }
  console.log(`race test passed: one winner holding ${held.length} seats in ${TRACK}, one refused with track-full, deltas ${deltas.join(',')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
