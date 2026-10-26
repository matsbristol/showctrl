import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import { festDay } from './time'
import { buildSummary, riserText, summaryCsv, toCsv } from './summary'

const T = Date.UTC(2026, 6, 10, 18)
const d = buildSample(T)
const input = { ...d.col, tz: 'Europe/Oslo', contacts: () => true }

describe('technical summary', () => {
  it('has one row per show with its day’s key times in order', () => {
    const day = festDay(T, 'Europe/Oslo')
    const rows = buildSummary(input, { day })
    expect(rows.length).toBe(15)
    const r = rows[0]
    expect(r.times.map(x => x.kind)).toContain('show')
    expect(r.times.map(x => x.start)).toEqual([...r.times.map(x => x.start)].sort((a, b) => a - b))
  })

  it('filters by stage and search, and hides contacts when not allowed', () => {
    const rows = buildSummary({ ...input, contacts: () => false }, { stage: 'tent', q: 'a' })
    expect(rows.every(r => r.show.stage === 'tent' && r.artist.name.toLowerCase().includes('a'))).toBe(true)
    expect(rows.every(r => r.contact === null)).toBe(true)
  })

  it('reports loads with destination names', () => {
    const rows = buildSummary(input)
    const withTrucks = rows.find(r => r.loadIn)!
    expect(withTrucks.loadIn!.dest).toMatch(/Load bay|Staging/)
  })

  it('describes risers from the stage plot', () => {
    expect(riserText({ id: 'p', artist: 'a', items: {
      a: { id: 'a', kind: 'riser', label: 'Drums', x: 0, y: 0, w: 2, d: 1, system: 'prolyte', size: '2x1', height: 40 },
      b: { id: 'b', kind: 'riser', label: 'Keys', x: 0, y: 0, w: 1, d: 1, system: 'nivtec', size: '1x1', height: 40 },
      c: { id: 'c', kind: 'riser', label: 'Drums', x: 0, y: 0, w: 2, d: 1, system: 'prolyte', size: '2x1', height: 40 },
    } })).toBe('2 × Prolyte 200 × 100 cm @ 40 cm, 1 × Nivtec 100 × 100 cm @ 40 cm')
    expect(riserText(undefined)).toBe('')
  })

  it('writes CSV that spreadsheets read correctly', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"'], [1, null, 'x\ny']])).toBe('a,"b,c","say ""hi"""\r\n1,,"x\ny"')
    const csv = summaryCsv(buildSummary(input), 'Europe/Oslo')
    expect(csv.split('\r\n')[0]).toMatch(/^Act,Stage,Day,Arrival,/)
    expect(csv.split('\r\n')).toHaveLength(46)
  })
})
