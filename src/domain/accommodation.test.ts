import { describe, expect, it } from 'vitest'
import type { Booking, Rider } from '../types/model'
import { bookingGuest, coversNight, nightsBetween, roomingList, roomingNights, roomsUsed } from './accommodation'
import { addRiderItems, changeRiderItem, parseRiderLines, removeRiderItem, riderProgress } from './riders'

const b = (id: string, over: Partial<Booking>): Booking =>
  ({ id, hotel: 'h1', checkIn: '2026-07-02', checkOut: '2026-07-03', rooms: 1, status: 'confirmed', ...over })

describe('nights', () => {
  it('counts nights up to check-out', () => {
    expect(nightsBetween('2026-07-30', '2026-08-02')).toEqual(['2026-07-30', '2026-07-31', '2026-08-01'])
    expect(nightsBetween('2026-07-02', '2026-07-02')).toEqual([])
  })

  it('shows the night before and after the event on the grid', () => {
    expect(roomingNights('2026-07-02', '2026-07-04')).toEqual(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'])
  })

  it('covers check-in night but not check-out night', () => {
    expect(coversNight(b('x', {}), '2026-07-02')).toBe(true)
    expect(coversNight(b('x', {}), '2026-07-03')).toBe(false)
  })
})

describe('rooms used', () => {
  const bookings = {
    a: b('a', { rooms: 3 }),
    b: b('b', { rooms: 2, checkIn: '2026-07-01', checkOut: '2026-07-04' }),
    c: b('c', { rooms: 5, status: 'cancelled' }),
    d: b('d', { rooms: 4, hotel: 'h2' }),
  }
  it('adds up active bookings at that hotel that night', () => {
    expect(roomsUsed(bookings, 'h1', '2026-07-02')).toBe(5)
    expect(roomsUsed(bookings, 'h1', '2026-07-03')).toBe(2)
    expect(roomsUsed(bookings, 'h2', '2026-07-02')).toBe(4)
    expect(roomsUsed(bookings, 'h1', '2026-07-05')).toBe(0)
  })
})

describe('rooming list', () => {
  const artists = {
    a1: { id: 'a1', name: 'Zed', stage: 'main', status: 'confirmed' as const, contacts: [] },
    a2: { id: 'a2', name: 'Abel', stage: 'tent', status: 'confirmed' as const, contacts: [] },
  }
  const bookings = {
    x: b('x', { artist: 'a1' }),
    y: b('y', { artist: 'a2' }),
    z: b('z', { guest: 'Press pool', checkIn: '2026-07-01' }),
    gone: b('gone', { artist: 'deleted' }),
    off: b('off', { artist: 'a1', status: 'cancelled' }),
  }
  it('lists active bookings by check-in then guest, optionally for one stage', () => {
    expect(roomingList(bookings, artists).map(x => x.id)).toEqual(['z', 'y', 'gone', 'x'])
    expect(roomingList(bookings, artists, 'main').map(x => x.id)).toEqual(['x'])
  })

  it('names the guest', () => {
    expect(bookingGuest(bookings.x, artists)).toBe('Zed')
    expect(bookingGuest(bookings.z, artists)).toBe('Press pool')
    expect(bookingGuest(bookings.gone, artists, 'Removed artist')).toBe('Removed artist')
  })
})

describe('riders', () => {
  it('reads one item per line, dropping bullets and numbers', () => {
    expect(parseRiderLines('- Drum riser\n• 6 wedges\n3. Hazer\n2) DI × 8\n\n  ')).toEqual(['Drum riser', '6 wedges', 'Hazer', 'DI × 8'])
    // A leading quantity is kept.
    expect(parseRiderLines('24 × still water 0.5 l\n12. 4 towels')).toEqual(['24 × still water 0.5 l', '4 towels'])
  })

  it('creates a rider, appends to it, and changes or removes an item', () => {
    const r1 = addRiderItems(undefined, 'a1', 'tech', ['Drum riser', 'Hazer'], 'stage', 100)
    expect(r1).toMatchObject({ id: 'a1_tech', artist: 'a1', kind: 'tech', updated: 100 })
    expect(r1.items.map(i => [i.text, i.status, i.dept])).toEqual([['Drum riser', 'requested', 'stage'], ['Hazer', 'requested', 'stage']])
    const r2: Rider = addRiderItems(r1, 'a1', 'tech', ['IEM × 4'], undefined, 200)
    expect(r2.items).toHaveLength(3)
    const changed = changeRiderItem(r2, r2.items[1].id, { status: 'declined', dept: 'light' }, 300)
    expect(changed.items[1]).toMatchObject({ text: 'Hazer', status: 'declined', dept: 'light' })
    expect(changed.items[0]).toEqual(r2.items[0])
    expect(removeRiderItem(r2, r2.items[0].id, 400).items.map(i => i.text)).toEqual(['Hazer', 'IEM × 4'])
  })

  it('counts settled and open items', () => {
    const items = [
      { id: '1', text: '', status: 'sourced' as const },
      { id: '2', text: '', status: 'declined' as const },
      { id: '3', text: '', status: 'agreed' as const },
      { id: '4', text: '', status: 'requested' as const },
    ]
    expect(riderProgress(items)).toEqual({ settled: 2, total: 4, open: 2 })
    expect(riderProgress([])).toEqual({ settled: 0, total: 0, open: 0 })
  })
})
