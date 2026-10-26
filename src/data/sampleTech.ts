// Sample technical data for the demo festival: input lists, stage plots and riser stock.

import type { Artist, Id, InputLine, Lines, OutputLine, Plot, PlotItem, RiserStock } from '../types/model'

const BAND_INPUTS: [string, string, string, boolean?][] = [
  ['Kick in', 'Beta 91A', '—'], ['Kick out', 'D6', 'short'], ['Snare top', 'SM57', 'clamp'], ['Snare bottom', 'e604', 'clamp'],
  ['Hi-hat', 'KM184', 'short', true], ['Rack tom', 'e604', 'clamp'], ['Floor tom', 'e604', 'clamp'], ['OH L', 'KM184', 'tall', true],
  ['OH R', 'KM184', 'tall', true], ['Bass DI', 'BSS AR-133', '—', true], ['Bass mic', 'RE20', 'short'], ['Gtr 1', 'MD421', 'short'],
  ['Gtr 2', 'SM57', 'short'], ['Keys L', 'DI', '—', true], ['Keys R', 'DI', '—', true], ['Lead vox', 'SM58', 'tall boom'],
  ['BV 1', 'SM58', 'tall boom'], ['BV 2', 'SM58', 'tall boom'], ['Spare vox', 'SM58', 'tall boom'], ['Talkback', 'SM58 switch', '—'],
]
const DJ_INPUTS: [string, string, string, boolean?][] = [
  ['Mixer master L', 'DI', '—'], ['Mixer master R', 'DI', '—'], ['Mixer booth L', 'DI', '—'], ['Mixer booth R', 'DI', '—'], ['MC mic', 'SM58 wireless', '—'],
]
const BAND_OUTPUTS: [string, string][] = [['Lead vox', 'Wedge'], ['Gtr 1', 'Wedge'], ['Bass', 'Wedge'], ['Drums', 'Drum fill'], ['Keys', 'IEM'], ['Sidefills', 'Sidefill']]

const isDj = (a: Artist) => /\bDJ\b|soundsystem|disco/i.test(a.name) || /house|electronic/i.test(a.genre ?? '')

export function sampleLines(a: Artist, i: number): Lines {
  const tpl = isDj(a) ? DJ_INPUTS : BAND_INPUTS.slice(0, 14 + (i % 7))
  const inputs: InputLine[] = tpl.map(([name, mic, stand, phantom], k) => ({ id: `in${k + 1}`, ch: k + 1, name, mic, stand, phantom: !!phantom, box: `SB${Math.floor(k / 12) + 1}-${(k % 12) + 1}` }))
  const outs = isDj(a) ? [['Booth', 'Booth monitor']] as [string, string][] : BAND_OUTPUTS.slice(0, 4 + (i % 3))
  const outputs: OutputLine[] = outs.map(([name, type], k) => ({ id: `out${k + 1}`, n: k + 1, name, type }))
  return { id: a.id, artist: a.id, inputs: Object.fromEntries(inputs.map(x => [x.id, x])), outputs: Object.fromEntries(outputs.map(x => [x.id, x])), notes: '' }
}

export function samplePlot(a: Artist, headliner: boolean, i: number): Plot {
  const items: PlotItem[] = []
  const put = (id: string, kind: PlotItem['kind'], label: string, x: number, y: number, w: number, d: number, extra: Partial<PlotItem> = {}) => items.push({ id, kind, label, x, y, w, d, ...extra })
  // The big stages stock Prolyte, the smaller ones Nivtec. A 2 × 2 m riser is two 2 × 1 m decks.
  const system = BIG_STAGES.includes(a.stage) ? 'prolyte' : 'nivtec'
  const deck = (height: number) => ({ system, size: '2x1', height, rolling: headliner }) as const
  if (isDj(a)) {
    put('r1', 'riser', 'DJ riser', 7, 5, 2, 1, deck(60))
    put('r1b', 'riser', 'DJ riser', 7, 4, 2, 1, deck(60))
    put('dj', 'other', 'DJ table', 7, 4.6, 2, 0.8)
    put('m1', 'monitor', 'Booth', 8.6, 4.5, 0.7, 0.5)
  } else {
    put('r1', 'riser', 'Drum riser', 7, 6.5, 2, 1, deck(40))
    put('r1b', 'riser', 'Drum riser', 7, 5.5, 2, 1, deck(40))
    put('dr', 'drums', 'Drums', 7, 6, 2, 2)
    if (i % 2 === 0) { put('r2', 'riser', 'Keys riser', 10.5, 5.4, 2, 1, deck(40)); put('kb', 'keys', 'Keys', 10.5, 5.4, 1.4, 0.6) }
    put('ba', 'amp', 'Bass amp', 4.6, 6.6, 0.9, 0.6)
    put('ga', 'amp', 'Gtr amp', 9.4, 6.8, 0.8, 0.5)
    put('v1', 'vocal', 'Lead vox', 7, 1.6, 0.5, 0.5)
    put('v2', 'vocal', 'BV 1', 4.2, 2.2, 0.5, 0.5)
    put('v3', 'vocal', 'Gtr / BV 2', 9.8, 2.2, 0.5, 0.5)
    put('w1', 'monitor', 'Wedge 1', 7, 0.6, 0.7, 0.5)
    put('w2', 'monitor', 'Wedge 2', 4.2, 1, 0.7, 0.5)
    put('w3', 'monitor', 'Wedge 3', 9.8, 1, 0.7, 0.5)
    put('p1', 'power', 'Power', 5, 5, 0.3, 0.3)
    put('p2', 'power', 'Power', 9, 5, 0.3, 0.3)
  }
  return { id: a.id, artist: a.id, items: Object.fromEntries(items.map(x => [x.id, x])), width: 14, depth: 9, notes: '' }
}

const BIG_STAGES = ['main', 'fjord']

export function sampleRiserStock(stage: Id): RiserStock {
  const big = BIG_STAGES.includes(stage)
  return {
    id: stage, stage, notes: '',
    systems: big
      ? { prolyte: { decks: { '2x1': 10, '1x1': 4, '2x0.5': 4, '1x0.5': 2 }, heights: [20, 40, 60, 80, 100], telescopic: true }, nivtec: { decks: { '2x1': 4, '1x1': 2 }, heights: [20, 40, 60], telescopic: false } }
      : { nivtec: { decks: { '2x1': 5, '1x1': 2 }, heights: [20, 40, 60], telescopic: false } },
  }
}
