import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import type { Booking } from '../types/model'
import { eventNights, nightsBetween, roomsUsed } from './accommodation'
import { nextOrder, openItems, parseRiderLines, riderItems, riderProgress } from './riders'

describe('riders', () => {
  it('parses pasted lines, stripping bullets and numbering', () => {
    const items = Object.values(parseRiderLines('- Drum riser\n2) 4 × wedges\n• Hazer\n12 × still water\n\n  ', 'audio', 5))
    expect(items.map(i => i.text)).toEqual(['Drum riser', '4 × wedges', 'Hazer', '12 × still water'])
    expect(items.map(i => i.order)).toEqual([5, 6, 7, 8])
    expect(items.every(i => i.status === 'requested' && i.dept === 'audio')).toBe(true)
  })

  it('orders items and counts progress', () => {
    const r = { items: {
      b: { id: 'b', text: 'B', status: 'sourced' as const, order: 1 },
      a: { id: 'a', text: 'A', status: 'requested' as const, order: 0 },
      c: { id: 'c', text: 'C', status: 'declined' as const, order: 2 },
      d: { id: 'd', text: 'D', status: 'agreed' as const, order: 3 },
    } }
    expect(riderItems(r).map(i => i.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(riderProgress(r)).toEqual({ done: 2, total: 4 })
    expect(openItems(r)).toBe(2)
    expect(nextOrder(r)).toBe(4)
    expect(nextOrder(null)).toBe(0)
  })

  it('keeps sample riders keyed by item id', () => {
    const d = buildSample(Date.UTC(2026, 6, 10, 18))
    const r = Object.values(d.col.riders)[0]
    for (const [k, v] of Object.entries(r.items)) expect(v.id).toBe(k)
  })
})

describe('accommodation', () => {
  const b = (hotel: string, checkIn: string, checkOut: string, rooms: number, status: Booking['status'] = 'confirmed'): Booking =>
    ({ id: `${hotel}${checkIn}${rooms}`, hotel, checkIn, checkOut, rooms, status })

  it('lists nights between two dates', () => {
    expect(nightsBetween('2026-07-09', '2026-07-12')).toEqual(['2026-07-09', '2026-07-10', '2026-07-11'])
    expect(eventNights(['2026-07-10', '2026-07-11'], '2026-07-10')).toEqual(['2026-07-09', '2026-07-10', '2026-07-11'])
  })

  it('counts rooms per hotel per night, skipping cancelled', () => {
    const bs = [b('h1', '2026-07-10', '2026-07-12', 2), b('h1', '2026-07-11', '2026-07-12', 3), b('h1', '2026-07-10', '2026-07-11', 9, 'cancelled'), b('h2', '2026-07-10', '2026-07-11', 4)]
    expect(roomsUsed(bs, 'h1', '2026-07-10')).toBe(2)
    expect(roomsUsed(bs, 'h1', '2026-07-11')).toBe(5)
    expect(roomsUsed(bs, 'h1', '2026-07-12')).toBe(0)
  })
})
