import { BatchGetCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { QueryCommandInput, ScanCommandInput } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { gsi1, keys } from './keys'
import { sessionSpecs } from '../../content/sessions'
import type { Attendee, EmailEvent, EmailEventType, EventConfig, OrderPointer, ReconcileSummary, Seat, Session, Subscriber, VerificationLog } from './types'

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

/** The pass link. GSI1, GSI1PK = TOKEN#<token>. */
export async function getAttendeeByToken(passToken: string): Promise<Attendee | null> {
  const page = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': gsi1.attendeeByToken(passToken).GSI1PK },
      Limit: 1,
    }),
  )
  return (page.Items?.[0] as Attendee | undefined) ?? null
}

export async function getAttendee(ticketRef: string): Promise<Attendee | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.attendee(ticketRef) }))
  return (res.Item as Attendee | undefined) ?? null
}

/**
 * The webhook knows an order id and nothing else about us. The pointer item
 * written at checkout resolves it. Null means we never created that order,
 * which is the first thing a forged or misrouted event fails on.
 */
export async function getAttendeeByOrder(orderId: string): Promise<Attendee | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.order(orderId) }))
  const pointer = res.Item as OrderPointer | undefined
  return pointer ? getAttendee(pointer.ticketRef) : null
}

/** One query returns the profile, every held seat and the verification log from the same partition. */
export async function getAttendeeWithSeats(
  ticketRef: string,
): Promise<{ attendee: Attendee | null; seats: Seat[]; log: VerificationLog[] }> {
  const items = await queryAll<Attendee | Seat | VerificationLog>({
    TableName: tableName(),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': keys.attendee(ticketRef).PK },
  })
  return {
    attendee: (items.find((i) => i.SK === 'PROFILE') as Attendee | undefined) ?? null,
    seats: items.filter((i) => i.SK.startsWith('SEAT#')) as Seat[],
    log: (items.filter((i) => i.SK.startsWith('VERIFY#')) as VerificationLog[]).sort((a, b) => a.at.localeCompare(b.at)),
  }
}

/**
 * All 12 sessions in content order, from the table. A session content
 * describes but the table lacks (never seeded) comes back as undefined in
 * its place, so a caller can tell "not seeded" from "full".
 */
export async function getAllSessions(): Promise<(Session | undefined)[]> {
  const specs = sessionSpecs()
  const table = tableName()
  const found = new Map<string, Session>()
  // BatchGet takes at most 100 keys and may return some unprocessed.
  let requestKeys = specs.map((s) => keys.session(s.sessionId))
  for (let attempt = 0; requestKeys.length > 0 && attempt < 6; attempt++) {
    const res = await ddb.send(new BatchGetCommand({ RequestItems: { [table]: { Keys: requestKeys } } }))
    for (const item of (res.Responses?.[table] ?? []) as Session[]) found.set(item.sessionId, item)
    requestKeys = (res.UnprocessedKeys?.[table]?.Keys ?? []) as typeof requestKeys
  }
  return specs.map((s) => found.get(s.sessionId))
}

/** Everything running opposite everything else in one time slot. */
export function getSessionsInSlot(slotId: string): Promise<Session[]> {
  return queryAll<Session>({
    TableName: tableName(),
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': gsi1.sessionBySlot(slotId, '').GSI1PK },
  })
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: keys.session(sessionId) }))
  return (res.Item as Session | undefined) ?? null
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

/**
 * The admin table. A scan is deliberate here, see SPEC.md section 6.
 * Do not add a GSI to avoid it.
 */
export function listAttendees(): Promise<Attendee[]> {
  return scanAll<Attendee>({
    TableName: tableName(),
    FilterExpression: 'SK = :sk AND begins_with(PK, :pk)',
    ExpressionAttributeValues: { ':sk': 'PROFILE', ':pk': 'ATT#' },
  })
}

/** Written by the reconcile Lambda. Null until it has ever run. */
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
