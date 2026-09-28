/**
 * The seat race. One technical session is set to exactly one free seat, then
 * two students place holds on it genuinely concurrently. One must win and
 * hold the seat; the other must be refused "full" with the session named and
 * leave no record behind; the session must end one seat higher, not two.
 *
 * Runs against the real sandbox table through placeHold, the function the
 * hold route calls, because the thing under test is a DynamoDB transaction
 * and a mock would only prove the mock works.
 *
 *   npm run race-test
 */
import { randomBytes } from 'node:crypto'
import { DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { keys } from '../src/lib/db/keys'
import type { Session } from '../src/lib/db/types'
import { placeHold } from '../src/lib/registration/flow'
import { setSessionCapacity } from '../src/lib/registration/state'
import type { HoldInput } from '../src/lib/registration/validate'

const CONTESTED = 't5'

async function session(id: string): Promise<Session | undefined> {
  return (await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.session(id), ConsistentRead: true }))).Item as Session | undefined
}

const input = (who: string): HoldInput => ({
  tier: 'basic',
  technicalSession: CONTESTED,
  firstName: who,
  lastName: 'Race',
  email: `${who}@example.test`,
  phone: '+919000000000',
  college: 'Race',
  branch: 'CSE',
  rollNumber: `RACE${who}`,
  yearOfStudy: '3',
  foodPreference: 'veg',
  dateOfBirth: '2004-01-01',
})

async function main(): Promise<void> {
  if (/main-branch/i.test(tableName())) throw new Error('refusing to race against production')
  const start = await session(CONTESTED)
  const original = start?.sellableCapacity ?? null
  const taken = start?.seatsTaken ?? 0
  await setSessionCapacity(CONTESTED, taken + 1, 'race-test@example.test')

  const key = () => randomBytes(18).toString('base64url')
  const results = await Promise.all([placeHold(input('racea'), key(), undefined, 'manual'), placeHold(input('raceb'), key(), undefined, 'manual')])
  const after = await session(CONTESTED)

  const winners = results.filter((r) => r.ok)
  const losers = results.filter((r) => !r.ok)
  const problems: string[] = []
  if (winners.length !== 1) problems.push(`expected exactly one winner, got ${winners.length}`)
  const loser = losers[0]
  if (losers.length !== 1 || !loser || loser.ok || loser.sessionId !== CONTESTED) problems.push(`loser was ${JSON.stringify(loser)}, not full on ${CONTESTED}`)
  if ((after?.seatsTaken ?? 0) - taken !== 1) problems.push(`${CONTESTED} went from ${taken} to ${after?.seatsTaken}, expected +1`)

  // Clean up: the winner's record, its seat, and the ceiling as it was.
  for (const r of winners) if (r.ok) await ddb.send(new DeleteCommand({ TableName: tableName(), Key: keys.attendee(r.attendee.passId) }))
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.session(CONTESTED),
      UpdateExpression: 'SET seatsTaken = :t, sellableCapacity = :c',
      ExpressionAttributeValues: { ':t': taken, ':c': original },
    }),
  )

  if (problems.length) {
    console.error('RACE TEST FAILED\n  ' + problems.join('\n  '))
    process.exit(1)
  }
  console.log(`race test passed: one hold, one refused "full" on ${CONTESTED}, seatsTaken ${taken} -> ${after?.seatsTaken}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
