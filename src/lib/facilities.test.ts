import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import type { Allocation, Facility } from '../types/model'
import { allocationClashes, dressingWindow } from './facilities'

const H = 3_600_000
const fac = (id: string, capacity?: number): Facility => ({ id, name: id, kind: 'dressing', capacity })
const al = (id: string, facility: string, from: number, to: number): Allocation => ({ id, facility, from, to })

describe('facilities', () => {
  it('flags overlapping bookings beyond capacity', () => {
    const c = allocationClashes([al('a', 'r1', 0, 3 * H), al('b', 'r1', 2 * H, 5 * H), al('c', 'r1', 5 * H, 6 * H), al('d', 'r2', 0, 3 * H), al('e', 'r2', 1 * H, 2 * H)], { r1: fac('r1'), r2: fac('r2', 2) })
    expect([...c].sort()).toEqual(['a', 'b'])
  })

  it('suggests a dressing room window from get in to departure', () => {
    const d = buildSample(Date.UTC(2026, 6, 10, 18))
    const items = Object.values(d.col.ros).filter(r => r.artist === 'a0').sort((x, y) => x.start - y.start)
    const w = dressingWindow(items)!
    expect(w.from).toBe(items.find(i => i.kind === 'getin')!.start)
    expect(w.to).toBe(items.find(i => i.kind === 'departure')!.end)
  })

  it('starts the sample festival without double bookings', () => {
    const d = buildSample(Date.UTC(2026, 6, 10, 18))
    expect(allocationClashes(Object.values(d.col.allocations), d.col.facilities).size).toBe(0)
    expect(Object.keys(d.col.allocations).length).toBeGreaterThan(5)
  })
})
