import { describe, expect, it } from 'vitest'
import type { Artist, RosItem, Stage } from '../types/model'
import { MIN } from './constants'
import { buildDaySheet, goLive, markDone, resetDelays, shiftFrom, stageDelay, type Change } from './runsheet'

const tz = 'Europe/Oslo'
const stage: Stage = { id: 'main', name: 'Main Stage', tape: 'red', order: 0 }
const a1: Artist = { id: 'a1', name: 'Hollow Pines', status: 'backstage', contacts: [] }
const a2: Artist = { id: 'a2', name: 'Grålys', status: 'arrived', contacts: [] }
const show1 = Date.UTC(2026, 6, 2, 18, 0) // 20:00 Oslo
const show2 = show1 + 90 * MIN

function sample(): Record<string, RosItem> {
  const items = [...buildDaySheet(stage, a1, show1, show1 + 60 * MIN), ...buildDaySheet(stage, a2, show2, show2 + 60 * MIN)]
  items.forEach((it, i) => { it.id = `${it.artist}_${it.kind}_${i}` })
  // Another day on the same stage, and another stage the same day: neither should move.
  items.push({ id: 'tomorrow', stage: 'main', kind: 'show', title: 'Tomorrow', start: show1 + 24 * 60 * MIN, end: show1 + 25 * 60 * MIN, status: 'pending', delay: 0 })
  items.push({ id: 'other', stage: 'tent', kind: 'show', title: 'Elsewhere', start: show1 + 30 * MIN, end: show1 + 60 * MIN, status: 'pending', delay: 0 })
  return Object.fromEntries(items.map(i => [i.id, i]))
}

const find = (ros: Record<string, RosItem>, artist: string, kind: string) => Object.values(ros).find(i => i.artist === artist && i.kind === kind)!
const ids = (changes: Change[]) => changes.map(c => c.id).sort()
const apply = (ros: Record<string, RosItem>, changes: Change[]) => {
  const out = structuredClone(ros)
  for (const c of changes) if (c.col === 'ros') Object.assign(out[c.id], c.patch)
  return out
}

describe('shiftFrom', () => {
  it('moves the item and everything after it that day on that stage', () => {
    const ros = sample()
    const from = find(ros, 'a1', 'show')
    const ch = shiftFrom(ros, from, 10 * MIN, { note: 'Power cut', tz })
    // a1's show and load out / departure, plus all of a2's day (which starts after a1's show… mostly).
    const moved = ids(ch)
    expect(moved).toContain(from.id)
    expect(moved).toContain(find(ros, 'a1', 'loadout').id)
    expect(moved).toContain(find(ros, 'a2', 'show').id)
    expect(moved).not.toContain(find(ros, 'a1', 'changeover').id) // before the show
    expect(moved).not.toContain('tomorrow')
    expect(moved).not.toContain('other')
    expect(ch.every(c => c.col === 'ros' && c.patch.delay === 10 * MIN)).toBe(true)
    // Only the item the delay was entered on carries the reason.
    expect(ch.filter(c => c.col === 'ros' && c.patch.delayNote)).toEqual([{ col: 'ros', id: from.id, patch: { delay: 10 * MIN, delayNote: 'Power cut' } }])
  })

  it('adds to existing delays and skips finished items', () => {
    const ros = sample()
    const from = find(ros, 'a1', 'show')
    ros[from.id].delay = 5 * MIN
    ros[find(ros, 'a1', 'loadout').id].status = 'done'
    const ch = shiftFrom(ros, ros[from.id], -3 * MIN, { tz })
    expect(ch.find(c => c.id === from.id)!.patch).toEqual({ delay: 2 * MIN })
    expect(ids(ch)).not.toContain(find(ros, 'a1', 'loadout').id)
  })

  it('can leave dock items where they are', () => {
    const ros = sample()
    const ch = shiftFrom(ros, find(ros, 'a1', 'show'), 10 * MIN, { dockToo: false, tz })
    expect(ids(ch)).not.toContain(find(ros, 'a1', 'loadout').id)
    expect(ids(ch)).not.toContain(find(ros, 'a2', 'loadin').id)
    expect(ids(ch)).toContain(find(ros, 'a2', 'show').id)
  })
})

describe('resetDelays and stageDelay', () => {
  it('reports the delay and puts the day back on planned times', () => {
    const ros = apply(sample(), shiftFrom(sample(), find(sample(), 'a1', 'show'), 10 * MIN, { note: 'x', tz }))
    expect(stageDelay(ros, 'main', show1 + 5 * MIN)).toBe(10 * MIN)
    const ch = resetDelays(ros, 'main', '2026-07-02', tz)
    expect(ch.every(c => c.col === 'ros' && c.patch.delay === 0 && c.patch.delayNote === '')).toBe(true)
    expect(stageDelay(apply(ros, ch), 'main', show1 + 5 * MIN)).toBe(0)
  })
})

describe('goLive', () => {
  it('makes the item live, finishes the previous live item and updates the artist', () => {
    const ros = sample()
    const co = find(ros, 'a1', 'changeover')
    ros[co.id].status = 'live'
    const show = find(ros, 'a1', 'show')
    const { changes, offer } = goLive(ros, show, show1 + 30_000, tz)
    expect(changes).toEqual([
      { col: 'ros', id: co.id, patch: { status: 'done' } },
      { col: 'ros', id: show.id, patch: { status: 'live', actual: show1 + 30_000 } },
      { col: 'artists', id: 'a1', patch: { status: 'on stage' } },
    ])
    expect(offer).toBeUndefined() // 30 s late is on time
  })

  it('offers to shift the rest when a show starts late', () => {
    const ros = sample()
    const show = find(ros, 'a1', 'show')
    const { offer } = goLive(ros, show, show1 + 7 * MIN + 20_000, tz)
    expect(offer).toMatchObject({ message: 'Hollow Pines went on 7 min late.', label: 'Shift the rest +7 min' })
    expect(offer!.changes.find(c => c.id === show.id)!.patch).toEqual({ delay: 7 * MIN, delayNote: 'Started late' })
  })

  it('offers to pull the rest earlier when a show starts early', () => {
    const ros = sample()
    const { offer } = goLive(ros, find(ros, 'a1', 'show'), show1 - 4 * MIN, tz)
    expect(offer!.label).toBe('Shift the rest −4 min')
    expect(offer!.changes[0].patch).toMatchObject({ delay: -4 * MIN })
  })

  it("doesn't finish live items on the dock when a dock item starts", () => {
    const ros = sample()
    const show = find(ros, 'a1', 'show')
    ros[show.id].status = 'live'
    const { changes } = goLive(ros, find(ros, 'a2', 'loadin'), show1 + 10 * MIN, tz)
    expect(ids(changes)).not.toContain(show.id)
  })
})

describe('markDone', () => {
  it('finishes the item and the artist', () => {
    const ros = sample()
    const show = find(ros, 'a1', 'show')
    const { changes, offer } = markDone(ros, show, show1 + 60 * MIN, tz)
    expect(changes).toEqual([
      { col: 'ros', id: show.id, patch: { status: 'done', actualEnd: show1 + 60 * MIN } },
      { col: 'artists', id: 'a1', patch: { status: 'done' } },
    ])
    expect(offer).toBeUndefined()
  })

  it('offers to push the next item when a show overran', () => {
    const ros = sample()
    const show = find(ros, 'a1', 'show')
    const { offer } = markDone(ros, show, show1 + 72 * MIN, tz)
    expect(offer).toMatchObject({ message: 'Hollow Pines overran by 12 min.', label: 'Shift the rest +12 min' })
    // The next unfinished item after the show starts is a2's stage access
    // (45 min before a2's show, so before a1's load out); it and everything after move.
    const first = offer!.changes.find(c => c.patch && 'delayNote' in c.patch)!
    expect(first.id).toBe(find(ros, 'a2', 'access').id)
    expect(ids(offer!.changes)).toContain(find(ros, 'a1', 'loadout').id)
    expect(first.patch).toEqual({ delay: 12 * MIN, delayNote: 'Hollow Pines overran' })
    expect(ids(offer!.changes)).toContain(find(ros, 'a2', 'show').id)
    expect(ids(offer!.changes)).not.toContain(show.id)
  })
})
