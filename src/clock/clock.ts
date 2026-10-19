/*
 * The shared clock. Everyone works to server time, not device time:
 * every 10 minutes the client reads the `Date` header from a HEAD request.
 * If the device is more than 1.5 s off, the offset is applied ("Corrected");
 * otherwise the device clock is trusted ("Synced"). If the server can't be
 * reached, device time is used ("Device time").
 *
 * When the real backend exists, point `syncClock` at it so server time comes
 * from the same place as the data.
 */
import { useSyncExternalStore } from 'react'
import { MIN } from '../domain/constants'

export type SyncState = 'device' | 'ok' | 'corrected'

export interface ClockStatus {
  state: SyncState
  /** Added to Date.now() to get server time, in ms. */
  offset: number
}

/** Below this the device clock is good enough and is left alone. */
export const SYNC_TOLERANCE = 1500
export const SYNC_INTERVAL = 10 * MIN

let status: ClockStatus = { state: 'device', offset: 0 }
const listeners = new Set<() => void>()

function setStatus(next: ClockStatus) {
  status = next
  for (const l of listeners) l()
}

/** Server-corrected time in epoch ms. Use this instead of Date.now() everywhere. */
export const now = () => Date.now() + status.offset

export const clockStatus = () => status

/**
 * Offset between server and device, from a request sent at device time `t0`
 * whose response arrived at `t1` with the given `Date` header.
 * The header only has whole seconds, so assume the middle of that second,
 * and assume the server stamped it halfway through the round trip.
 */
export function offsetFromDateHeader(t0: number, t1: number, dateHeader: string | null): number | null {
  if (!dateHeader) return null
  const server = Date.parse(dateHeader)
  if (Number.isNaN(server)) return null
  return server + 500 - (t0 + t1) / 2
}

export function classifyOffset(offset: number): ClockStatus {
  return Math.abs(offset) > SYNC_TOLERANCE ? { state: 'corrected', offset } : { state: 'ok', offset: 0 }
}

/** Measures the offset once and updates the shared status. */
export async function syncClock(url = typeof location === 'undefined' ? '' : location.href, fetchImpl: typeof fetch = fetch): Promise<ClockStatus> {
  try {
    if (!/^https?:/.test(url)) throw new Error('no server to sync against')
    const t0 = Date.now()
    const res = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' })
    const t1 = Date.now()
    const off = offsetFromDateHeader(t0, t1, res.headers.get('date'))
    if (off == null) throw new Error('no Date header')
    setStatus(classifyOffset(off))
  } catch {
    setStatus({ state: 'device', offset: 0 })
  }
  return status
}

/** Syncs now and every 10 minutes. Returns a stop function. */
export function startClockSync(): () => void {
  void syncClock()
  const id = setInterval(() => void syncClock(), SYNC_INTERVAL)
  return () => clearInterval(id)
}

/** Re-renders when the sync status changes. */
export function useClockStatus(): ClockStatus {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    clockStatus,
    clockStatus,
  )
}

/*
 * One shared ticker per interval, so a page with forty countdowns runs one
 * timer, and every countdown on screen changes on the same tick.
 */
interface Ticker { t: number; listeners: Set<() => void>; id: ReturnType<typeof setInterval> | null }
const tickers = new Map<number, Ticker>()

function ticker(everyMs: number): Ticker {
  let tk = tickers.get(everyMs)
  if (!tk) {
    tk = { t: now(), listeners: new Set(), id: null }
    tickers.set(everyMs, tk)
  }
  return tk
}

function subscribeTick(everyMs: number, cb: () => void) {
  const tk = ticker(everyMs)
  tk.listeners.add(cb)
  if (!tk.id) {
    tk.t = now()
    tk.id = setInterval(() => {
      // A new sync offset is picked up on the next tick.
      tk.t = now()
      for (const l of tk.listeners) l()
    }, everyMs)
  }
  return () => {
    tk.listeners.delete(cb)
    if (!tk.listeners.size && tk.id) {
      clearInterval(tk.id)
      tk.id = null
    }
  }
}

/**
 * Server time, refreshed every `everyMs`. Use 250 for anything showing
 * seconds (so the display never skips a second), longer for coarse state
 * such as "is a show live".
 */
export function useNow(everyMs = 250): number {
  return useSyncExternalStore(
    cb => subscribeTick(everyMs, cb),
    () => ticker(everyMs).t,
    () => ticker(everyMs).t,
  )
}
