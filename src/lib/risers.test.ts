import { describe, expect, it } from 'vitest'
import type { Plot, PlotItem, RiserSystem } from '../types/model'
import { deckText, needs, peak, planRisers, stockOf } from './risers'

const r = (id: string, size: string, rolling = false, height = 40, system?: RiserSystem): PlotItem => ({ id, kind: 'riser', label: id, x: 0, y: 0, w: 1, d: 1, size, height, rolling, system })
const plot = (...items: PlotItem[]): Plot => ({ id: 'p', artist: 'a', items: Object.fromEntries(items.map(i => [i.id, i])) })

describe('riser planning', () => {
  it('counts decks per system, rolling ones and heights from a plot', () => {
    const p = plot(r('a', '2x1', false, 40, 'prolyte'), r('b', '2x1', true, 60, 'prolyte'), r('c', '1x1', false, 40, 'nivtec'), r('d', '2x1'))
    const pro = needs(p, 'prolyte')
    expect(pro.all).toEqual({ '2x1': 3 }) // an item without a system counts as Prolyte
    expect(pro.rolling).toEqual({ '2x1': 1 })
    expect(pro.heights).toEqual([40, 60])
    expect(needs(p, 'nivtec').all).toEqual({ '1x1': 1 })
  })

  it('counts the next act’s rolling risers as in use during the current show, per system', () => {
    const stock = { id: 's', stage: 's', systems: { prolyte: { decks: { '2x1': 2, '1x1': 2 }, heights: [40] }, nivtec: { decks: { '2x1': 1 }, heights: [40] } } }
    const acts = [
      { act: 'A', plot: plot(r('a1', '2x1', false, 40, 'prolyte'), r('a2', '2x1', false, 40, 'prolyte')) },
      { act: 'B', plot: plot(r('b1', '2x1', true, 40, 'prolyte'), r('b2', '1x1', true, 40, 'prolyte'), r('b3', '2x1', false, 40, 'nivtec')) },
      { act: 'C', plot: undefined },
    ]
    const rows = planRisers(acts, stock, 'prolyte')
    expect(rows[0].inUse).toEqual({ '2x1': 3, '1x1': 1 })
    expect(rows[0].short).toEqual({ '2x1': 1 })
    expect(rows[1].short).toEqual({})
    expect(rows[1].change).toEqual({ '2x1': -1, '1x1': 1 })
    expect(rows[2].change).toEqual({ '2x1': -1, '1x1': -1 })
    expect(peak(rows)).toEqual({ '2x1': 3, '1x1': 1 })
    // Nivtec is counted on its own: B's Nivtec deck fits the one in stock.
    expect(planRisers(acts, stock, 'nivtec').map(x => x.short)).toEqual([{}, {}, {}])
  })

  it('flags heights the stage has no legs for, in that system', () => {
    const stock = { id: 's', stage: 's', systems: { nivtec: { decks: { '2x1': 4 }, heights: [20, 40, 60] } } }
    const [row] = planRisers([{ act: 'A', plot: plot(r('a', '2x1', false, 80, 'nivtec')) }], stock, 'nivtec')
    expect(row.missingHeights).toEqual([80])
  })

  it('reads stock saved before systems as Prolyte, and keeps old 8 ft decks countable', () => {
    const old = { id: 's', stage: 's', decks: { '8x8': 2 }, heights: [20, 40] }
    expect(stockOf(old, 'prolyte')).toEqual({ decks: { '8x8': 2 }, heights: [20, 40] })
    expect(stockOf(old, 'nivtec')).toEqual({ decks: {}, heights: [] })
    const [row] = planRisers([{ act: 'A', plot: plot(r('a', '8x8'), r('b', '8x8'), r('c', '8x8')) }], old, 'prolyte')
    expect(row.short).toEqual({ '8x8': 1 })
  })

  it('writes deck counts for people', () => {
    expect(deckText({ '2x1': 2, '1x1': -1 }, 'prolyte', true)).toBe('+2 of 2×1 m, -1 of 1×1 m')
    expect(deckText({ '8x8': 1 }, 'prolyte')).toBe('1 of 8×8 ft')
    expect(deckText({}, 'nivtec')).toBe('')
  })
})
