import { describe, expect, it } from 'vitest'
import { festDay, fromLocal } from '../lib/time'
import { buildSample } from './sample'

const tz = 'Europe/Oslo'

describe('sample festival at real hours', () => {
  it('starts today with the first show at 15:00 and gates at 17:00; at 14:15 only a soundcheck is running', () => {
    const t = fromLocal('2026-10-27T14:15', tz)!
    const d = buildSample(t, { realTimes: true })
    const today = Object.values(d.col.ros).filter(r => festDay(r.start, tz) === '2026-10-27')
    const shows = today.filter(r => r.kind === 'show').sort((x, y) => x.start - y.start)
    expect(d.cfg!.start).toBe('2026-10-27')
    expect(shows[0].start).toBe(fromLocal('2026-10-27T15:00', tz))
    expect(today.find(r => r.kind === 'doors')!.start).toBe(fromLocal('2026-10-27T17:00', tz))
    expect(today.filter(r => r.status === 'live').map(r => r.kind)).toEqual(['soundcheck'])
    expect(today.filter(r => r.delay)).toEqual([])
    // Arrivals that already happened are done; every show is still to come.
    expect(today.some(r => r.kind === 'arrival' && r.status === 'done')).toBe(true)
    expect(shows.every(s => s.status === 'pending')).toBe(true)
    expect(d.col.clocks.c2.target).toBeGreaterThan(t)
  })

  it('marks what has happened when reset in the evening', () => {
    const t = fromLocal('2026-10-27T19:10', tz)!
    const d = buildSample(t, { realTimes: true })
    const today = Object.values(d.col.ros).filter(r => festDay(r.start, tz) === '2026-10-27')
    expect(today.some(r => r.kind === 'show' && r.status === 'live')).toBe(true)
    expect(today.some(r => r.kind === 'show' && r.status === 'done')).toBe(true)
  })
})
