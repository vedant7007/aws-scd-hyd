/**
 * Self check for the gate queue. Pure logic, no browser and no network, so it
 * runs anywhere. The queue is the thing standing between a failed access point
 * and a lost check in, so it gets a test.
 *
 *   npm run check:queue
 */
import assert from 'node:assert/strict'
import {
  QUEUE_KEY,
  drainQueue,
  enqueue,
  loadQueue,
  lookupCached,
  saveRoster,
  type KeyValueStore,
  type QueuedWrite,
} from '../src/lib/scan-queue'

function memoryStore(seed: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

const entry = (ticketRef: string, action: 'checkin' | 'swag' = 'checkin') => ({
  id: `${ticketRef}:${action}`,
  ticketRef,
  action,
  queuedAt: '2026-10-30T04:00:00.000Z',
})

async function main(): Promise<void> {
  // A corrupt queue must not brick the scanner at a gate.
  assert.deepEqual(loadQueue(memoryStore({ [QUEUE_KEY]: 'not json' })), [])

  // Same ticket and action twice is one intent, not two entries.
  {
    const s = memoryStore()
    enqueue(s, entry('SEED-001'))
    enqueue(s, entry('SEED-001'))
    assert.equal(loadQueue(s).length, 1, 'duplicate intent should collapse')
    enqueue(s, entry('SEED-001', 'swag'))
    assert.equal(loadQueue(s).length, 2, 'a different action is a separate entry')
  }

  // Everything delivers: queue empties.
  {
    const s = memoryStore()
    enqueue(s, entry('SEED-001'))
    enqueue(s, entry('SEED-002'))
    const r = await drainQueue(s, async () => ({ delivered: true, retry: false }))
    assert.equal(r.delivered, 2)
    assert.equal(r.remaining, 0)
  }

  // Transport failure: nothing is lost, and it stops rather than hammering.
  {
    const s = memoryStore()
    enqueue(s, entry('SEED-001'))
    enqueue(s, entry('SEED-002'))
    let calls = 0
    const r = await drainQueue(s, async () => {
      calls++
      throw new Error('offline')
    })
    assert.equal(r.delivered, 0)
    assert.equal(r.remaining, 2, 'offline writes must survive')
    assert.equal(calls, 1, 'should stop after the first transport failure')
    assert.equal(loadQueue(s)[0].attempts, 1, 'attempts should be recorded')
  }

  // A considered 4xx is dropped, not retried forever.
  {
    const s = memoryStore()
    enqueue(s, entry('GHOST-999'))
    const r = await drainQueue(s, async () => ({ delivered: false, retry: false }))
    assert.equal(r.delivered, 0)
    assert.equal(r.remaining, 0, 'a rejected write should not stay queued forever')
  }

  // Reconnect drains what was queued while offline.
  {
    const s = memoryStore()
    enqueue(s, entry('SEED-001'))
    await drainQueue(s, async () => {
      throw new Error('offline')
    })
    assert.equal(loadQueue(s).length, 1)
    const sent: QueuedWrite[] = []
    const r = await drainQueue(s, async (e) => {
      sent.push(e)
      return { delivered: true, retry: false }
    })
    assert.equal(r.delivered, 1)
    assert.equal(r.remaining, 0)
    assert.equal(sent[0].ticketRef, 'SEED-001')
  }

  // Cached roster answers a lookup with no network.
  {
    const s = memoryStore()
    saveRoster(s, [
      { ticketRef: 'SEED-001', name: 'Aarav Reddy', tier: 'basic', foodPreference: 'veg', college: 'VJIT' },
    ])
    assert.equal(lookupCached(s, 'SEED-001')?.name, 'Aarav Reddy')
    assert.equal(lookupCached(s, 'NOPE-000'), null)
  }

  console.log('ok, scan queue survives corruption, dedupes, keeps offline writes and drains on reconnect')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
