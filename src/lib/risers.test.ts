import { describe, expect, it } from 'vitest'
import type { Plot, PlotItem } from '../types/model'
import { deckText, needs, peak, planRisers } from './risers'

const r = (id: string, size: PlotItem['size'], rolling = false, height = 40): PlotItem => ({ id, kind: 'riser', label: id, x: 0, y: 0, w: 1, d: 1, size, height, rolling })
const plot = (...items: PlotItem[]): Plot => ({ id: 'p', artist: 'a', items: Object.fromEntries(items.map(i => [i.id, i])) })

describe('riser planning', () => {
  it('counts decks by size, rolling ones and heights from a plot', () => {
    const n = needs(plot(r('a', '8x8'), r('b', '8x8', true, 60), r('c', '8x4')))
    expect(n.all).toEqual({ '8x8': 2, '8x4': 1 })
    expect(n.rolling).toEqual({ '8x8': 1 })
    expect(n.heights).toEqual([40, 60])
  })

  it('counts the next act’s rolling risers as in use during the current show', () => {
    const rows = planRisers([
      { act: 'A', plot: plot(r('a1', '8x8'), r('a2', '8x8')) },
      { act: 'B', plot: plot(r('b1', '8x8', true), r('b2', '8x4', true)) },
      { act: 'C', plot: undefined },
    ], { id: 's', stage: 's', decks: { '8x8': 2, '8x4': 2 }, heights: [40] })
    expect(rows[0].inUse).toEqual({ '8x8': 3, '8x4': 1 })
    expect(rows[0].short).toEqual({ '8x8': 1 })
    expect(rows[1].short).toEqual({})
    expect(rows[1].change).toEqual({ '8x8': -1, '8x4': 1 })
    expect(rows[2].change).toEqual({ '8x8': -1, '8x4': -1 })
    expect(peak(rows)).toEqual({ '8x8': 3, '8x4': 1 })
  })

  it('flags heights the stage has no legs for', () => {
    const [row] = planRisers([{ act: 'A', plot: plot(r('a', '8x8', false, 80)) }], { id: 's', stage: 's', decks: { '8x8': 4 }, heights: [20, 40, 60] })
    expect(row.missingHeights).toEqual([80])
  })

  it('writes deck counts for people', () => {
    expect(deckText({ '8x8': 2, '8x4': -1 }, true)).toBe('+2 × 8x8, -1 × 8x4')
    expect(deckText({})).toBe('')
  })
})
