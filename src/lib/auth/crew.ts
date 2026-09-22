import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../db/client'
import { gsi1, keys, normaliseEmail } from '../db/keys'
import { failedIndexes, transactWithRetry, type TransactItem } from '../db/seats'
import type { CrewAudit, CrewRole, CrewUser, UsersMeta } from '../db/types'
import { auditItem } from '../registration/state'

/**
 * Who may do what, stored in the table so people can be added without a
 * redeploy. Two roles: an admin does everything, a volunteer runs the gate
 * scanner and nothing else. The guard in lib/auth/admin.ts reads this on
 * every request; nothing in the UI is trusted.
 *
 * This module never touches Cognito or a cookie, so the acceptance suite
 * can drive it directly.
 */

/** The first admin. Seeded once, by bootstrapFirstAdmin, and never again. */
export const BOOTSTRAP_ADMIN = 'vedantidlgave16@gmail.com'

const table = () => tableName()
const now = () => new Date().toISOString()

export async function getUser(email: string): Promise<CrewUser | null> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.user(email), ConsistentRead: true }))
  return (res.Item as CrewUser | undefined) ?? null
}

/** Every crew account, oldest first. */
export async function listUsers(): Promise<CrewUser[]> {
  const out: CrewUser[] = []
  let cursor: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': gsi1.userByDate('').GSI1PK },
        ExclusiveStartKey: cursor,
      }),
    )
    out.push(...((page.Items ?? []) as CrewUser[]))
    cursor = page.LastEvaluatedKey
  } while (cursor)
  return out
}

/**
 * How many admins the table holds, from the META item that every add,
 * role change and removal updates in its own transaction. Zero is the
 * signal for the ADMIN_EMAILS fallback.
 */
export async function adminCount(): Promise<number> {
  const res = await ddb.send(new GetCommand({ TableName: table(), Key: keys.usersMeta(), ConsistentRead: true }))
  return Number((res.Item as UsersMeta | undefined)?.admins ?? 0)
}

/** The audit trail, newest first. */
export async function listCrewAudit(limit = 100): Promise<CrewAudit[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': keys.crewAudit('', '').PK },
      ScanIndexForward: false,
      Limit: limit,
    }),
  )
  return (res.Items ?? []) as CrewAudit[]
}

/** The META item, moved by delta under a floor. Used inside the transactions below. */
function metaItem(delta: number, floor: number): TransactItem {
  return {
    Update: {
      TableName: table(),
      Key: keys.usersMeta(),
      UpdateExpression: 'SET admins = if_not_exists(admins, :zero) + :d',
      ConditionExpression: delta < 0 ? 'admins >= :floor' : undefined,
      ExpressionAttributeValues: { ':zero': 0, ':d': delta, ...(delta < 0 ? { ':floor': floor } : {}) },
    },
  }
}

export type UserChange =
  | { ok: true; user: CrewUser }
  | { ok: false; reason: 'exists' | 'missing' | 'last-admin' | 'invalid-email' | 'self' }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Puts the user item, counts an admin, writes the audit line, in one transaction. */
export async function addUser(email: string, role: CrewRole, by: string): Promise<UserChange> {
  const clean = normaliseEmail(email)
  if (!EMAIL.test(clean)) return { ok: false, reason: 'invalid-email' }
  const at = now()
  const user: CrewUser = { ...keys.user(clean), ...gsi1.userByDate(at), email: clean, role, addedBy: by, addedAt: at }
  const items: TransactItem[] = [
    { Put: { TableName: table(), Item: user, ConditionExpression: 'attribute_not_exists(PK)' } },
    auditItem({ action: 'add', by, target: clean, role, at }),
  ]
  if (role === 'admin') items.push(metaItem(+1, 0))
  try {
    await transactWithRetry(items)
    return { ok: true, user }
  } catch (err) {
    if (failedIndexes(err).includes(0)) return { ok: false, reason: 'exists' }
    throw err
  }
}

/**
 * Changes a role. Demoting an admin is conditional on the META count
 * staying at one or more, so the last admin cannot demote themselves and
 * two admins cannot demote each other into zero at the same moment.
 */
export async function setRole(email: string, role: CrewRole, by: string): Promise<UserChange> {
  const clean = normaliseEmail(email)
  const user = await getUser(clean)
  if (!user) return { ok: false, reason: 'missing' }
  if (user.role === role) return { ok: true, user }
  const at = now()
  const items: TransactItem[] = [
    {
      Update: {
        TableName: table(),
        Key: keys.user(clean),
        UpdateExpression: 'SET #role = :role',
        ConditionExpression: '#role = :was',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': role, ':was': user.role },
      },
    },
    auditItem({ action: 'role', by, target: clean, role, at }),
    role === 'admin' ? metaItem(+1, 0) : metaItem(-1, 2),
  ]
  try {
    await transactWithRetry(items)
    return { ok: true, user: { ...user, role } }
  } catch (err) {
    const failed = failedIndexes(err)
    if (failed.includes(2)) return { ok: false, reason: 'last-admin' }
    if (failed.includes(0)) return { ok: false, reason: 'missing' }
    throw err
  }
}

/** Removes a user. Removing an admin is conditional on at least one other admin remaining. */
export async function removeUser(email: string, by: string): Promise<UserChange> {
  const clean = normaliseEmail(email)
  const user = await getUser(clean)
  if (!user) return { ok: false, reason: 'missing' }
  const at = now()
  const items: TransactItem[] = [
    {
      Delete: {
        TableName: table(),
        Key: keys.user(clean),
        ConditionExpression: '#role = :was',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':was': user.role },
      },
    },
    auditItem({ action: 'remove', by, target: clean, role: user.role, at }),
  ]
  if (user.role === 'admin') items.push(metaItem(-1, 2))
  try {
    await transactWithRetry(items)
    return { ok: true, user }
  } catch (err) {
    const failed = failedIndexes(err)
    if (failed.includes(2)) return { ok: false, reason: 'last-admin' }
    if (failed.includes(0)) return { ok: false, reason: 'missing' }
    throw err
  }
}

/**
 * Seeds the first admin. Runs once: the BOOTSTRAP item is put in the same
 * transaction with a condition that it does not exist, so a second call,
 * from anywhere, ever, changes nothing. Removing or demoting that account
 * later is an ordinary user change and this cannot undo it.
 */
export async function bootstrapFirstAdmin(): Promise<{ done: boolean }> {
  const at = now()
  const user: CrewUser = { ...keys.user(BOOTSTRAP_ADMIN), ...gsi1.userByDate(at), email: BOOTSTRAP_ADMIN, role: 'admin', addedBy: 'bootstrap', addedAt: at }
  try {
    await transactWithRetry([
      { Put: { TableName: table(), Item: { ...keys.bootstrap(), at }, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: table(), Item: user, ConditionExpression: 'attribute_not_exists(PK)' } },
      auditItem({ action: 'bootstrap', by: 'bootstrap', target: BOOTSTRAP_ADMIN, role: 'admin', at }),
      metaItem(+1, 0),
    ])
    return { done: true }
  } catch (err) {
    const failed = failedIndexes(err)
    if (!failed.length) throw err
    // The account already exists but the marker does not: write the marker
    // alone, so removing that account later can never bring this back.
    if (!failed.includes(0) && failed.includes(1)) {
      try {
        await transactWithRetry([{ Put: { TableName: table(), Item: { ...keys.bootstrap(), at, note: 'account existed' }, ConditionExpression: 'attribute_not_exists(PK)' } }])
      } catch (err2) {
        if (!failedIndexes(err2).length) throw err2
      }
    }
    return { done: false }
  }
}

