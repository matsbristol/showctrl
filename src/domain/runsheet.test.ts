import { describe, expect, it } from 'vitest'
import type { Artist, Stage } from '../types/model'
import { MIN } from './constants'
import { buildDaySheet, eff, nowNext, track } from './runsheet'

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

describe('nowNext', () => {
  const items = Object.fromEntries(buildDaySheet(stage, artist, show, showEnd).map(i => [i.id, i]))
  const second = buildDaySheet(stage, { ...artist, id: 'a2', name: 'Grålys' }, showEnd + 30 * MIN, showEnd + 90 * MIN)
  const ros = { ...items, ...Object.fromEntries(second.map(i => [i.id, i])) }
  const kindAt = (t: number) => {
    const { cur, next } = nowNext(ros, 'main', t)
    return [cur && `${cur.kind}:${cur.artist}`, next && `${next.kind}:${next.artist}`]
  }

  it('finds the item on stage and the next show', () => {
    expect(kindAt(show - 10 * MIN)).toEqual(['changeover:a1', 'show:a1'])
    expect(kindAt(show + 10 * MIN)).toEqual(['show:a1', 'show:a2'])
    expect(kindAt(showEnd + 10 * MIN)).toEqual(['changeover:a2', 'show:a2'])
  })

  it('ignores dock items and stage access', () => {
    // Load in (dock) and stage access (a point) are going on, but nothing is on stage.
    expect(kindAt(show - 100 * MIN)).toEqual([undefined, 'show:a1'])
    expect(kindAt(show - 45 * MIN)).toEqual([undefined, 'show:a1'])
  })

  it('prefers the item marked live, and applies delays', () => {
    const s1 = Object.values(ros).find(i => i.kind === 'show' && i.artist === 'a1')!
    const late = { ...ros, [s1.id]: { ...s1, status: 'live' as const } }
    // Running over: still live after its planned end.
    expect(nowNext(late, 'main', showEnd + 40 * MIN).cur?.id).toBe(s1.id)
    // Delayed 15 min: not on yet at +5, on at +20.
    const delayed = { ...ros, [s1.id]: { ...s1, delay: 15 * MIN } }
    expect(nowNext(delayed, 'main', show + 5 * MIN)).toMatchObject({ cur: undefined, next: { id: s1.id } })
    expect(nowNext(delayed, 'main', show + 20 * MIN).cur?.id).toBe(s1.id)
  })

  it('skips finished shows', () => {
    const s1 = Object.values(ros).find(i => i.kind === 'show' && i.artist === 'a1')!
    const done = { ...ros, [s1.id]: { ...s1, status: 'done' as const } }
    expect(nowNext(done, 'main', show - 10 * MIN).next?.artist).toBe('a2')
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
