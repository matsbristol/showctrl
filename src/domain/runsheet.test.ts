import { describe, expect, it } from 'vitest'
import type { Artist, Stage } from '../types/model'
import { MIN } from './constants'
import { buildDaySheet, eff, track } from './runsheet'

const stage: Stage = { id: 'main', name: 'Main Stage', tape: 'red', order: 0 }
const artist: Artist = { id: 'a1', name: 'Hollow Pines', status: 'confirmed', contacts: [] }
const show = Date.UTC(2026, 6, 2, 18, 0)
const showEnd = show + 60 * MIN

/** Minutes relative to show start. */
const rel = (ms: number) => (ms - show) / MIN

describe('buildDaySheet', () => {
  it('builds the eight default items around the show', () => {
    const items = buildDaySheet(stage, artist, show, showEnd)
    expect(items.map(i => [i.kind, rel(i.start), rel(i.end)])).toEqual([
      ['arrival', -240, -225],
      ['getin', -180, -165],
      ['loadin', -120, -75],
      ['access', -45, -45],
      ['changeover', -30, 0],
      ['show', 0, 60],
      ['loadout', 75, 120],
      ['departure', 210, 225],
    ])
    for (const i of items) {
      expect(i).toMatchObject({ stage: 'main', artist: 'a1', status: 'pending', delay: 0 })
    }
    expect(items.find(i => i.kind === 'changeover')!.title).toBe('Changeover → Hollow Pines')
    expect(new Set(items.map(i => i.id)).size).toBe(8)
  })

  it("uses the stage's template and adds a soundcheck", () => {
    const custom = { ...stage, template: { changeover: 45, soundcheckDur: 30 } }
    const sc = show - 4 * 60 * MIN
    const items = buildDaySheet(custom, artist, show, showEnd, sc)
    expect(items).toHaveLength(9)
    const co = items.find(i => i.kind === 'changeover')!
    expect([rel(co.start), rel(co.end)]).toEqual([-45, 0])
    const check = items.find(i => i.kind === 'soundcheck')!
    expect([rel(check.start), rel(check.end)]).toEqual([-240, -210])
  })
})

describe('item helpers', () => {
  it('applies the delay to both ends', () => {
    expect(eff({ start: 0, end: 10, delay: 5 })).toEqual({ s: 5, e: 15 })
  })

  it('puts each kind on its track', () => {
    expect(track({ kind: 'loadin' })).toBe('dock')
    expect(track({ kind: 'show' })).toBe('stage')
    expect(track({ kind: 'meeting' })).toBe('dock')
  })
})
