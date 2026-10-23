// Shared clock: every device works to server time.
// The Worker's /time answers { now, colo } with millisecond precision. Each sync takes a few
// readings and keeps the one with the fastest round trip, since half of that round trip is the
// most the reading can be off. Any other server falls back to the HTTP Date header (1 s steps).

export type SyncState = 'device' | 'ok' | 'corrected'

export interface SyncResult {
  /** Add to Date.now() to get server time. */
  offset: number
  state: SyncState
  /** Most the offset can be wrong by, in ms (half the best round trip; 1000 for the Date header). */
  error?: number
  /** The Cloudflare data centre whose clock was read, e.g. "ARN". */
  source?: string | null
  /** When this was measured (server time). */
  at?: number
}

/** A device clock further off than this counts as corrected rather than in sync. */
export const SYNC_TOLERANCE = 1500
export const SYNC_INTERVAL = 10 * 60_000
export const SYNC_SAMPLES = 5

type Reading = { offset: number; rtt: number; source: string | null; precise: boolean }

async function read(url: string, fetchFn: typeof fetch, clock: () => number): Promise<Reading | null> {
  const t0 = clock()
  const r = await fetchFn(url, { method: 'GET', cache: 'no-store' })
  const t1 = clock()
  const mid = (t0 + t1) / 2
  if (r.headers.get('content-type')?.includes('application/json')) {
    const body = await r.json().catch(() => null) as { now?: number; colo?: string | null } | null
    if (typeof body?.now === 'number') return { offset: body.now - mid, rtt: t1 - t0, source: body.colo ?? null, precise: true }
  }
  const h = r.headers.get('date')
  if (!h) return null
  return { offset: Date.parse(h) + 500 - mid, rtt: t1 - t0, source: null, precise: false } // the header is truncated to the second
}

/** Server time from a JSON `{ now, colo? }` endpoint, or the Date header of any response. */
export async function measureOffset(url: string, fetchFn: typeof fetch = fetch, clock: () => number = Date.now, samples = SYNC_SAMPLES): Promise<SyncResult> {
  let best: Reading | null = null
  for (let i = 0; i < samples; i++) {
    try {
      const r = await read(url, fetchFn, clock)
      if (!r) break
      if (!best || r.rtt < best.rtt) best = r
      if (!r.precise) break // more Date-header readings add nothing
    } catch {
      if (!best) return { offset: 0, state: 'device' }
      break
    }
  }
  if (!best) return { offset: 0, state: 'device' }
  const at = clock() + best.offset
  if (!best.precise) {
    // One-second steps: only correct a clearly wrong device clock.
    return Math.abs(best.offset) > SYNC_TOLERANCE ? { offset: best.offset, state: 'corrected', error: 1000, at } : { offset: 0, state: 'ok', error: 1000, at }
  }
  const offset = Math.round(best.offset)
  return { offset, state: Math.abs(offset) > SYNC_TOLERANCE ? 'corrected' : 'ok', error: Math.max(1, Math.round(best.rtt / 2)), source: best.source, at }
}
