import { GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { QueryCommandInput, ScanCommandInput } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './client'
import { gsi1, keys } from './keys'
import type { Attendee, EventConfig, Selection, Session, Subscriber } from './types'

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

/** One query returns the profile and every slot selection in the same partition. */
export async function getAttendeeWithSelections(
  ticketRef: string,
): Promise<{ attendee: Attendee | null; selections: Selection[] }> {
  const items = await queryAll<Attendee | Selection>({
    TableName: tableName(),
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': keys.attendee(ticketRef).PK },
  })
  return {
    attendee: (items.find((i) => i.SK === 'PROFILE') as Attendee | undefined) ?? null,
    selections: items.filter((i) => i.SK.startsWith('SLOT#')) as Selection[],
  }
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
