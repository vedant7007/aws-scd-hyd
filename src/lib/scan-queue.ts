/**
 * Offline queue for the gate scanner.
 *
 * Campus wifi will fail on 30 October, see SPEC.md section 11. A check in that
 * cannot reach the table must not be lost and must not block the queue at the
 * door, so it is written to local storage and retried until it lands.
 *
 * Storage is injected so this logic is testable outside a browser.
 */

export type QueuedAction = 'checkin' | 'swag'

export type QueuedWrite = {
  id: string
  ticketRef: string
  action: QueuedAction
  queuedAt: string
  attempts: number
}

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

export const QUEUE_KEY = 'scd.scan.queue'
export const ROSTER_KEY = 'scd.scan.roster'

export function loadQueue(store: KeyValueStore): QueuedWrite[] {
  const raw = store.getItem(QUEUE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : []
  } catch {
    // A corrupt queue must not brick the scanner at a gate.
    return []
  }
}

export function saveQueue(store: KeyValueStore, queue: QueuedWrite[]): void {
  store.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueue(
  store: KeyValueStore,
  entry: Omit<QueuedWrite, 'attempts'>,
): QueuedWrite[] {
  const queue = loadQueue(store)
  // Same ticket and same action twice is the same intent, not two entries.
  if (queue.some((q) => q.ticketRef === entry.ticketRef && q.action === entry.action)) return queue
  const next = [...queue, { ...entry, attempts: 0 }]
  saveQueue(store, next)
  return next
}

export type SendResult = { delivered: boolean; retry: boolean }

/**
 * Drains in order. A write that the server rejected on its own terms, an
 * unknown ticket for example, is dropped rather than retried forever. Anything
 * that looks like a transport failure stays queued.
 */
export async function drainQueue(
  store: KeyValueStore,
  send: (entry: QueuedWrite) => Promise<SendResult>,
): Promise<{ delivered: number; remaining: number }> {
  let queue = loadQueue(store)
  let delivered = 0

  for (const entry of [...queue]) {
    let result: SendResult
    try {
      result = await send(entry)
    } catch {
      result = { delivered: false, retry: true }
    }

    if (result.delivered || !result.retry) {
      queue = queue.filter((q) => q.id !== entry.id)
      if (result.delivered) delivered++
      saveQueue(store, queue)
    } else {
      queue = queue.map((q) => (q.id === entry.id ? { ...q, attempts: q.attempts + 1 } : q))
      saveQueue(store, queue)
      // Stop on the first transport failure, the rest will fail the same way.
      break
    }
  }

  return { delivered, remaining: loadQueue(store).length }
}

export type RosterEntry = {
  ticketRef: string
  name: string
  tier: string
  foodPreference: string
  college: string
}

/** Cached so a scan still shows a name when the network is gone. */
export function saveRoster(store: KeyValueStore, roster: RosterEntry[]): void {
  store.setItem(ROSTER_KEY, JSON.stringify(roster))
}

export function lookupCached(store: KeyValueStore, ticketRef: string): RosterEntry | null {
  const raw = store.getItem(ROSTER_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return (parsed as RosterEntry[]).find((r) => r.ticketRef === ticketRef) ?? null
  } catch {
    return null
  }
}
