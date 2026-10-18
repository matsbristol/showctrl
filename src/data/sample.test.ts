import { describe, expect, it } from 'vitest'
import { buildDaySheet } from '../lib/daySheet'
import { festDay, fromLocal, toLocal } from '../lib/time'
import { KINDS, LEGACY_KINDS, MIN } from '../types/constants'
import { buildSample } from './sample'

const T = Date.UTC(2026, 6, 10, 18, 0) // 20:00 in Oslo (summer time)

describe('buildSample', () => {
  const d = buildSample(T)

  it('builds the demo festival', () => {
    expect(Object.keys(d.col.stages)).toHaveLength(5)
    expect(Object.keys(d.col.artists)).toHaveLength(45)
    expect(Object.keys(d.col.members)).toContain('demo-admin')
    expect(d.col.stageteam.main.crew).toEqual({ 'demo-crew-main-3': true, 'demo-crew-main-6': true })
    expect(d.cfg?.start).toBe('2026-07-10')
    expect(d.cfg?.end).toBe('2026-07-12')
  })

  it('only references records that exist', () => {
    const { col } = d
    for (const r of Object.values(col.ros)) {
      expect(col.stages[r.stage]).toBeDefined()
      if (r.artist) expect(col.artists[r.artist]).toBeDefined()
      expect({ ...KINDS, ...LEGACY_KINDS }[r.kind]).toBeDefined()
    }
    for (const a of Object.values(col.artists)) expect(col.stages[a.stage]).toBeDefined()
    for (const m of Object.values(col.members)) if (m.person) expect(col.people[m.person]).toBeDefined()
    for (const b of Object.values(col.bookings)) expect(col.hotels[b.hotel]).toBeDefined()
    for (const c of Object.values(col.clocks)) if (c.kind === 'stage') expect(col.stages[c.stage]).toBeDefined()
  })

  it('makes today live, with The Tent running 10 minutes late', () => {
    const live = Object.values(d.col.ros).filter(r => r.status === 'live')
    expect(live.length).toBeGreaterThan(0)
    const tent = Object.values(d.col.ros).filter(r => r.stage === 'tent' && r.delay)
    expect(tent.every(r => r.delay === 10 * MIN)).toBe(true)
    expect(tent.some(r => r.delayNote === 'Late arrival from airport')).toBe(true)
  })
})

describe('buildDaySheet', () => {
  it('uses the stage template around the show', () => {
    const show = fromLocal('2026-07-10T21:00', 'Europe/Oslo')!
    const items = buildDaySheet({ id: 's', template: { changeover: 45 } }, { id: 'a', name: 'Band' }, show, show + 60 * MIN, show - 4 * 60 * MIN)
    const at = (k: string) => items.find(i => i.kind === k)!
    expect(items).toHaveLength(9)
    expect(toLocal(at('arrival').start, 'Europe/Oslo')).toBe('2026-07-10T17:00')
    expect(at('access').start).toBe(at('access').end)
    expect(at('changeover')).toMatchObject({ start: show - 45 * MIN, end: show, title: 'Changeover → Band' })
    expect(toLocal(at('loadout').start, 'Europe/Oslo')).toBe('2026-07-10T22:15')
    expect(at('soundcheck').end - at('soundcheck').start).toBe(45 * MIN)
  })
})

describe('time helpers', () => {
  it('converts wall-clock time in the event zone, across DST', () => {
    expect(fromLocal('2026-07-10T20:00', 'Europe/Oslo')).toBe(Date.UTC(2026, 6, 10, 18))
    expect(fromLocal('2026-01-10T20:00', 'Europe/Oslo')).toBe(Date.UTC(2026, 0, 10, 19))
    expect(toLocal(Date.UTC(2026, 6, 10, 18), 'America/New_York')).toBe('2026-07-10T14:00')
  })

  it('counts the hours before 06:00 as the previous show day', () => {
    expect(festDay(fromLocal('2026-07-11T05:59', 'Europe/Oslo')!, 'Europe/Oslo')).toBe('2026-07-10')
    expect(festDay(fromLocal('2026-07-11T06:00', 'Europe/Oslo')!, 'Europe/Oslo')).toBe('2026-07-11')
  })
})
