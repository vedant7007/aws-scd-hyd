import { BatchGetCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { QueryCommandInput, ScanCommandInput } from '@aws-sdk/lib-dynamodb'
import { programSessions } from '../../content/program'
import { ddb, tableName } from './client'
import { gsi1, keys, normalisePassId } from './keys'
import type {
  Attendee,
  EmailEvent,
  EmailEventType,
  EventConfig,
  ReconcileSummary,
  Session,
  Subscriber,
  VerificationLog,
} from './types'

/**
 * Drain every page. DynamoDB truncates at 1 MB regardless of how few items
 * matched a filter, so a single-shot query silently loses rows.
 */
async function queryAll<T>(input: QueryCommandInput): Promise<T[]> {
  const out: T[] = []
  let cursor: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(new QueryCommand({ ...input, ExclusiveStartKey: cursor }))
    out.push(...((page.Items ?? []) as T[]))
    cursor = page.LastEvaluatedKey
  } while (cursor)
  return out
}

async function scanAll<T>(input: ScanCommandInput): Promise<T[]> {
  const out: T[] = []
  let cursor: Record<string, unknown> | undefined
  do {
    const page = await ddb.send(new ScanCommand({ ...input, ExclusiveStartKey: cursor }))
    out.push(...((page.Items ?? []) as T[]))
    cursor = page.LastEvaluatedKey
  } while (cursor)
  return out
}

/**
 * The public lookup: whatever a person typed, normalised, then GSI1 with
 * GSI1PK = PASS#<passId>. Null for anything that is not a pass id or is not
 * in the table; the caller decides what to say, and says the same thing for
 * both.
 */
export async function getAttendeeByPass(typed: string): Promise<Attendee | null> {
  const passId = normalisePassId(typed)
  if (!passId) return null
  const page = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': gsi1.attendeeByPass(passId).GSI1PK },
      Limit: 1,
    }),
  )
  return (page.Items?.[0] as Attendee | undefined) ?? null
}

/** By primary key, for code that already holds a canonical pass id. */
export async function getAttendee(passId: string): Promise<Attendee | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.attendee(passId) }))
  return (res.Item as Attendee | undefined) ?? null
}

/** One query returns the profile and the admin log from the same partition. */
export async function getAttendeeWithLog(passId: string): Promise<{ attendee: Attendee | null; log: VerificationLog[] }> {
  const items = await queryAll<Attendee | VerificationLog>({
    TableName: tableName(),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': keys.attendee(passId).PK },
  })
  return {
    attendee: (items.find((i) => i.SK === 'PROFILE') as Attendee | undefined) ?? null,
    log: (items.filter((i) => i.SK.startsWith('VERIFY#')) as VerificationLog[]).sort((a, b) => a.at.localeCompare(b.at)),
  }
}

/**
 * The seven session counters in content order. A session no admin has sized
 * yet has no item, and comes back as undefined in its place, so a caller can
 * tell "not sized" from "full".
 */
export async function getSessions(): Promise<(Session | undefined)[]> {
  const table = tableName()
  const found = new Map<string, Session>()
  let requestKeys = programSessions.map((s) => keys.session(s.id))
  for (let attempt = 0; requestKeys.length > 0 && attempt < 6; attempt++) {
    const res = await ddb.send(new BatchGetCommand({ RequestItems: { [table]: { Keys: requestKeys } } }))
    for (const item of (res.Responses?.[table] ?? []) as Session[]) found.set(item.sessionId, item)
    requestKeys = (res.UnprocessedKeys?.[table]?.Keys ?? []) as typeof requestKeys
  }
  return programSessions.map((s) => found.get(s.id))
}

export async function getConfig(): Promise<EventConfig | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.config() }))
  return (res.Item as EventConfig | undefined) ?? null
}

/** Newest first. */
export function listSubscribers(): Promise<Subscriber[]> {
  return queryAll<Subscriber>({
    TableName: tableName(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': gsi1.subscriberByDate('').GSI1PK },
    ScanIndexForward: false,
  })
}

export type HitRow = { SK: string; views?: number; visits?: number }

/**
 * Every traffic row for each day asked for, keyed by day. One Query per day
 * rather than a scan: fourteen small reads against fourteen partitions.
 */
export async function getTraffic(days: string[]): Promise<Record<string, HitRow[]>> {
  const rows = await Promise.all(
    days.map((day) =>
      queryAll<HitRow>({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': keys.hits(day, '').PK },
      }),
    ),
  )
  return Object.fromEntries(days.map((d, i) => [d, rows[i]!]))
}

/**
 * The admin table. A scan is deliberate here, see SPEC.md section 6.
 * Do not add a GSI to avoid it.
 */
export async function listAttendees(): Promise<Attendee[]> {
  const rows = await scanAll<Attendee>({
    TableName: tableName(),
    FilterExpression: 'SK = :sk AND begins_with(PK, :pk)',
    ExpressionAttributeValues: { ':sk': 'PROFILE', ':pk': 'ATT#' },
  })
  // Records made under an earlier model (no technical session: the track and
  // slot era) are not attendees under this one and are left alone.
  return rows.filter((a) => typeof a.passId === 'string' && typeof a.state === 'string' && typeof a.technicalSession === 'string')
}

/** Written by the scheduled run. Null until it has ever run. */
export async function getReconcileSummary(): Promise<ReconcileSummary | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.reconcile() }))
  return (res.Item as ReconcileSummary | undefined) ?? null
}

/** Every bounce or complaint of one type, newest first. GSI1 keyed by type. */
export function listEmailEvents(type: EmailEventType): Promise<EmailEvent[]> {
  return queryAll<EmailEvent>({
    TableName: tableName(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': gsi1.emailEventByType(type, '').GSI1PK },
    ScanIndexForward: false,
  })
}
