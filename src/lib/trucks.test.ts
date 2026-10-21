import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import { MIN } from '../types/constants'
import type { Location, RosItem } from '../types/model'
import { clashes, locationCapacity, parseTrucks, truckMoves } from './trucks'

const T = Date.UTC(2026, 6, 10, 18)
const item = (id: string, start: number, end: number, trucks: number, dest: string, delay = 0): RosItem =>
  ({ id, stage: 's', kind: 'loadin', title: id, start, end, status: 'pending', delay, trucks, dest })
const bay: Location = { id: 'bay', name: 'Bay', kind: 'loadbay', stage: 's' }
const staging: Location = { id: 'stg', name: 'Staging', kind: 'staging', stage: null }

describe('trucks', () => {
  it('reads truck counts from free text', () => {
    expect(parseTrucks('2 trucks, 2 sleeper buses')).toBe(2)
    expect(parseTrucks('1 truck, 1 sleeper bus')).toBe(1)
    expect(parseTrucks('1 splitter van')).toBe(0)
    expect(parseTrucks(undefined)).toBe(0)
  })

  it('defaults capacity to one for bays and docks, unlimited elsewhere', () => {
    expect(locationCapacity(bay)).toBe(1)
    expect(locationCapacity(staging)).toBe(Infinity)
    expect(locationCapacity({ ...bay, capacity: 3 })).toBe(3)
  })

  it('finds overlapping loads at a full location, including delays', () => {
    const a = item('a', T, T + 45 * MIN, 1, 'bay')
    const b = item('b', T + 60 * MIN, T + 90 * MIN, 1, 'bay', -30 * MIN) // pulled 30 min earlier: overlaps a
    const c = item('c', T + 120 * MIN, T + 150 * MIN, 1, 'bay')
    const found = clashes([a, b, c], { bay })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ location: 'bay', from: T + 30 * MIN, to: T + 45 * MIN, trucks: 2, capacity: 1 })
    expect(found[0].items.sort()).toEqual(['a', 'b'])
  })

  it('never flags unlimited locations, or two trucks in a two-truck bay', () => {
    expect(clashes([item('a', T, T + MIN * 30, 3, 'stg'), item('b', T, T + MIN * 30, 3, 'stg')], { stg: staging })).toEqual([])
    expect(clashes([item('a', T, T + MIN * 30, 1, 'bay'), item('b', T, T + MIN * 30, 1, 'bay')], { bay: { ...bay, capacity: 2 } })).toEqual([])
  })

  it('gives the sample festival trucks with somewhere to go', () => {
    const d = buildSample(T)
    const moves = truckMoves(d.col.ros)
    expect(moves.length).toBeGreaterThan(10)
    expect(moves.every(m => m.dest && d.col.locations[m.dest])).toBe(true)
    expect(moves.every(m => m.kind === 'loadin' || m.kind === 'loadout')).toBe(true)
  })
})
