import { describe, expect, it } from 'vitest'
import { MIN } from '../domain/constants'
import { festDay } from '../domain/time'
import { buildSample } from './sample'

const NOW = Date.UTC(2026, 6, 2, 18, 0) // 20:00 in Oslo

describe('buildSample', () => {
  const s = buildSample(NOW)

  it('builds the sample festival', () => {
    expect(s.cfg).toMatchObject({ name: 'Nordlys Open Air 2026', start: '2026-07-02', end: '2026-07-04', tz: 'Europe/Oslo' })
    expect(Object.keys(s.col.stages)).toHaveLength(5)
    expect(Object.keys(s.col.artists)).toHaveLength(45)
    // 45 acts × 8 items, a soundcheck for each headliner (15), doors and curfew on 3 days
    expect(Object.keys(s.col.ros)).toHaveLength(45 * 8 + 15 + 6)
    expect(Object.keys(s.col.people)).toHaveLength(5 * 10 + 9)
    expect(Object.keys(s.col.members)).toHaveLength(13)
  })

  it('is the same for the same moment', () => {
    expect(buildSample(NOW)).toEqual(s)
  })

  it('keeps references intact', () => {
    for (const r of Object.values(s.col.ros)) {
      expect(s.col.stages[r.stage]).toBeDefined()
      if (r.artist) expect(s.col.artists[r.artist]).toBeDefined()
    }
    for (const m of Object.values(s.col.members)) {
      if (m.person) expect(s.col.people[m.person]).toBeDefined()
      for (const sid of Object.keys(m.stages)) expect(s.col.stages[sid]).toBeDefined()
    }
    for (const b of Object.values(s.col.bookings)) expect(s.col.hotels[b.hotel]).toBeDefined()
  })

  it('has The Tent running 10 minutes late today', () => {
    const late = Object.values(s.col.ros).filter(r => r.stage === 'tent' && r.delay)
    expect(late.length).toBeGreaterThan(0)
    expect(late.every(r => r.delay === 10 * MIN && festDay(r.start) === '2026-07-02')).toBe(true)
    expect(late.filter(r => r.delayNote)).toHaveLength(1)
  })

  it('sets day 1 statuses relative to now', () => {
    const today = Object.values(s.col.ros).filter(r => festDay(r.start) === '2026-07-02')
    expect(today.some(r => r.status === 'done')).toBe(true)
    expect(today.some(r => r.status === 'live')).toBe(true)
    const tomorrowShows = Object.values(s.col.ros).filter(r => r.kind === 'show' && festDay(r.start) === '2026-07-03')
    expect(tomorrowShows.every(r => s.col.artists[r.artist!].status === 'travelling')).toBe(true)
  })
})
