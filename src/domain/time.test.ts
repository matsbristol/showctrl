import { describe, expect, it } from 'vitest'
import { addDays, dayKey, eventDays, festDay, fmtTime, fromLocal, toLocal } from './time'

describe('time zone conversion', () => {
  it('converts Oslo wall time in summer (UTC+2) and winter (UTC+1)', () => {
    expect(fromLocal('2026-07-02T20:00', 'Europe/Oslo')).toBe(Date.UTC(2026, 6, 2, 18, 0))
    expect(fromLocal('2026-01-15T20:00', 'Europe/Oslo')).toBe(Date.UTC(2026, 0, 15, 19, 0))
  })

  it('round-trips through toLocal in other zones', () => {
    for (const tz of ['Europe/Oslo', 'America/New_York', 'Asia/Tokyo', 'UTC']) {
      expect(toLocal(fromLocal('2026-07-02T23:45', tz), tz)).toBe('2026-07-02T23:45')
    }
  })

  it('handles the hours either side of a DST change', () => {
    // Oslo goes back from 03:00 to 02:00 on 25 Oct 2026.
    expect(toLocal(fromLocal('2026-10-25T01:30', 'Europe/Oslo'), 'Europe/Oslo')).toBe('2026-10-25T01:30')
    expect(toLocal(fromLocal('2026-10-25T04:00', 'Europe/Oslo'), 'Europe/Oslo')).toBe('2026-10-25T04:00')
  })

  it('formats in the given zone, not the device zone', () => {
    const ms = Date.UTC(2026, 6, 2, 18, 5, 9)
    expect(fmtTime(ms, false, 'Europe/Oslo')).toBe('20:05')
    expect(fmtTime(ms, true, 'America/New_York')).toBe('14:05:09')
    expect(toLocal(null)).toBe('')
    expect(fromLocal('')).toBeNull()
  })
})

describe('festival days', () => {
  it('runs a show day until 06:00', () => {
    const tz = 'Europe/Oslo'
    expect(festDay(fromLocal('2026-07-03T02:00', tz)!, tz)).toBe('2026-07-02')
    expect(festDay(fromLocal('2026-07-03T05:59', tz)!, tz)).toBe('2026-07-02')
    expect(festDay(fromLocal('2026-07-03T06:00', tz)!, tz)).toBe('2026-07-03')
    expect(dayKey(fromLocal('2026-07-03T02:00', tz)!, tz)).toBe('2026-07-03')
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('lists event days inclusive', () => {
    expect(eventDays('2026-07-02', '2026-07-04')).toEqual(['2026-07-02', '2026-07-03', '2026-07-04'])
    expect(eventDays('2026-07-02')).toEqual(['2026-07-02'])
    expect(eventDays()).toEqual([])
  })
})
