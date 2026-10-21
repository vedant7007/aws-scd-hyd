import { BatchGetCommand, GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { collegeShort } from '../../content/colleges'
import { REFERRAL_CUTOFF } from '../../content/referral'
import { ddb, tableName } from '../db/client'
import { keys, normaliseEmail, normalisePassId } from '../db/keys'
import { getAttendee, listAttendees } from '../db/queries'
import type { Attendee, RefCode } from '../db/types'

/**
 * Where a referral lives. The code item (REFCODE#<code>) is the uniqueness
 * rule and points at its owner; the owner's record carries refCode; the
 * people they brought carry referredBy. The leaderboard is counted from the
 * live records every time, so a rejected or deleted registration drops off
 * it without anyone touching a counter.
 */

/** Past the payment step and not rejected: the receipt email has gone, so they count and may own a code. */
export const isLive = (a: Pick<Attendee, 'state' | 'source'>) => (a.state === 'PENDING_VERIFICATION' || a.state === 'VERIFIED') && a.source !== 'preview'

/** Shown on the public board: first name and the initial of the last. */
export const displayName = (a: Pick<Attendee, 'firstName' | 'lastName'>) => `${a.firstName.trim()} ${a.lastName.trim().slice(0, 1).toUpperCase()}.`.trim()

/** The live owner of a code, or null for a code nobody holds, or whose owner was rejected or deleted. */
export async function codeOwner(code: string): Promise<Attendee | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.refCode(code) }))
  const item = res.Item as RefCode | undefined
  if (!item) return null
  const owner = await getAttendee(item.passId)
  return owner && isLive(owner) && owner.refCode === code ? owner : null
}

/** Which of these codes nobody has claimed yet, in the order given. */
export async function unclaimed(codes: string[]): Promise<string[]> {
  if (!codes.length) return []
  const table = tableName()
  const taken = new Set<string>()
  let requestKeys = codes.map((c) => keys.refCode(c))
  for (let attempt = 0; requestKeys.length && attempt < 5; attempt++) {
    const res = await ddb.send(new BatchGetCommand({ RequestItems: { [table]: { Keys: requestKeys, ProjectionExpression: 'code' } } }))
    for (const i of (res.Responses?.[table] ?? []) as Pick<RefCode, 'code'>[]) taken.add(i.code)
    requestKeys = (res.UnprocessedKeys?.[table]?.Keys ?? []) as typeof requestKeys
  }
  return codes.filter((c) => !taken.has(c))
}

/**
 * The person behind a pass ID and email pair, when both match a live
 * registration. Both are in their own registration email, which is the
 * whole of the proof asked for here. Null for anything else.
 */
export async function findMine(passIdRaw: string, emailRaw: string): Promise<Attendee | null> {
  const passId = normalisePassId(passIdRaw)
  if (!passId) return null
  const a = await getAttendee(passId)
  return a && isLive(a) && a.email === normaliseEmail(emailRaw) ? a : null
}

export type ClaimOutcome = { ok: true } | { ok: false; reason: 'taken' | 'has-code' }

/** The code item and the owner's refCode in one transaction: the code is taken once, and a person holds one code. */
export async function claimCode(a: Attendee, code: string): Promise<ClaimOutcome> {
  const at = new Date().toISOString()
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: tableName(), Item: { ...keys.refCode(code), code, passId: a.passId, createdAt: at } satisfies RefCode, ConditionExpression: 'attribute_not_exists(PK)' } },
          {
            Update: {
              TableName: tableName(),
              Key: keys.attendee(a.passId),
              UpdateExpression: 'SET refCode = :c, refCodeAt = :at',
              ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(refCode)',
              ExpressionAttributeValues: { ':c': code, ':at': at },
            },
          },
        ],
      }),
    )
    return { ok: true }
  } catch (err) {
    const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons
    if (!reasons) throw err
    return { ok: false, reason: reasons[1]?.Code === 'ConditionalCheckFailed' ? 'has-code' : 'taken' }
  }
}

/** Adds the code someone registered with, after the fact. Once only: a referrer already on the record is never replaced. */
export async function addReferrer(a: Attendee, code: string): Promise<boolean> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: keys.attendee(a.passId),
        UpdateExpression: 'SET referredBy = :c, referredAt = :at',
        ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(referredBy)',
        ExpressionAttributeValues: { ':c': code, ':at': new Date().toISOString() },
      }),
    )
    return true
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return false
    throw err
  }
}

/** A referral that counts: the person is live, and both the referral and their payment came before the cutoff. */
export const counts = (a: Attendee) => Boolean(a.referredBy) && isLive(a) && (a.referredAt ?? '') <= REFERRAL_CUTOFF && (a.utrSubmittedAt ?? a.createdAt) <= REFERRAL_CUTOFF

export type BoardRow = { rank: number; code: string; name: string; college: string; count: number }

/** Every live code owner with at least one referral, most first; ties go to whoever got there first. */
export function board(all: Attendee[]): BoardRow[] {
  const owners = new Map(all.filter((a) => a.refCode && isLive(a)).map((a) => [a.refCode!, a]))
  const tally = new Map<string, { count: number; last: string }>()
  for (const a of all) {
    if (!counts(a) || !owners.has(a.referredBy!)) continue
    const t = tally.get(a.referredBy!) ?? { count: 0, last: '' }
    const at = a.utrSubmittedAt ?? a.createdAt
    tally.set(a.referredBy!, { count: t.count + 1, last: at > t.last ? at : t.last })
  }
  return [...tally]
    .sort((x, y) => y[1].count - x[1].count || x[1].last.localeCompare(y[1].last))
    .map(([code, t], i) => {
      const o = owners.get(code)!
      return { rank: i + 1, code, name: displayName(o), college: collegeShort(o.college), count: t.count }
    })
}

/**
 * The public board, read at most once a minute per server. It is a scan of
 * the registrations; a minute's staleness is nothing to a leaderboard.
 * ponytail: per-process memo, fine for one Amplify compute; a shared cache if it ever runs wide.
 */
let memo: { at: number; rows: BoardRow[] } | null = null
export async function leaderboard(): Promise<BoardRow[]> {
  if (memo && Date.now() - memo.at < 60_000) return memo.rows
  const rows = board(await listAttendees())
  memo = { at: Date.now(), rows }
  return rows
}
