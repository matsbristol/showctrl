// Shared clock: every device works to server time.
// Today this reads the HTTP Date header (1 s resolution, as the prototype did).
// The Cloudflare Worker will add a /time endpoint with millisecond precision.

export type SyncState = 'device' | 'ok' | 'corrected'

export interface SyncResult {
  /** Add to Date.now() to get server time. */
  offset: number
  state: SyncState
}

/** Offsets smaller than this are treated as in sync. */
export const SYNC_TOLERANCE = 1500
export const SYNC_INTERVAL = 10 * 60_000

/** Server time from a JSON `{ now: ms }` endpoint, or the Date header of any response. */
export async function measureOffset(url: string, fetchFn: typeof fetch = fetch, clock: () => number = Date.now): Promise<SyncResult> {
  try {
    const t0 = clock()
    const r = await fetchFn(url, { method: 'GET', cache: 'no-store' })
    const t1 = clock()
    const mid = (t0 + t1) / 2
    let server: number | null = null
    if (r.headers.get('content-type')?.includes('application/json')) {
      const body = await r.json().catch(() => null) as { now?: number } | null
      if (typeof body?.now === 'number') server = body.now
    }
    if (server == null) {
      const h = r.headers.get('date')
      if (!h) return { offset: 0, state: 'device' }
      server = Date.parse(h) + 500 // the header is truncated to the second
    }
    const offset = server - mid
    return Math.abs(offset) > SYNC_TOLERANCE ? { offset, state: 'corrected' } : { offset: 0, state: 'ok' }
  } catch {
    return { offset: 0, state: 'device' }
  }
}
