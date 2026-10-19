import { describe, expect, it } from 'vitest'
import { classifyOffset, clockStatus, now, offsetFromDateHeader, syncClock } from './clock'

const fakeFetch = (date: string | null) => (async () => ({ headers: new Headers(date ? { date } : {}) })) as unknown as typeof fetch

describe('clock sync', () => {
  it('reads the offset from the Date header, mid-second and mid-round-trip', () => {
    const server = Date.UTC(2026, 6, 2, 18, 0, 10)
    const header = new Date(server).toUTCString()
    // Request sent 2 s before the server's second began, reply 200 ms later.
    const off = offsetFromDateHeader(server - 2000, server - 1800, header)
    expect(off).toBe(500 + 1900)
    expect(offsetFromDateHeader(0, 0, null)).toBeNull()
    expect(offsetFromDateHeader(0, 0, 'not a date')).toBeNull()
  })

  it('only corrects when the device is more than 1.5 s off', () => {
    expect(classifyOffset(1400)).toEqual({ state: 'ok', offset: 0 })
    expect(classifyOffset(-1400)).toEqual({ state: 'ok', offset: 0 })
    expect(classifyOffset(4000)).toEqual({ state: 'corrected', offset: 4000 })
  })

  it('applies a large offset to now()', async () => {
    const ahead = new Date(Date.now() + 60_000).toUTCString()
    const s = await syncClock('https://example.test/', fakeFetch(ahead))
    expect(s.state).toBe('corrected')
    expect(now() - Date.now()).toBeGreaterThan(58_000)
  })

  it('falls back to device time without a server or Date header', async () => {
    expect((await syncClock('file:///x', fakeFetch(null))).state).toBe('device')
    expect((await syncClock('https://example.test/', fakeFetch(null))).state).toBe('device')
    expect(clockStatus().offset).toBe(0)
  })
})
