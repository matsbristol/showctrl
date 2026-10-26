// Riser planning: what each act's stage plot needs, against the stage's stock, per riser system
// (Prolyte and Nivtec decks and legs don't mix, so each is counted on its own).
//
// Rolling risers are built off stage while the act before is still playing, so during that
// show both acts' decks are in use: the current act's, plus the next act's rolling ones.

import { LEGACY_RISER_SIZES, RISER_SYSTEMS } from '../types/constants'
import type { Plot, PlotItem, RiserSize, RiserStock, RiserSystem, RiserSystemStock } from '../types/model'
import { tr } from '../i18n'

export type DeckCount = Record<RiserSize, number>
export const SYSTEMS = Object.keys(RISER_SYSTEMS) as RiserSystem[]
export const DEFAULT_SYSTEM: RiserSystem = 'prolyte'

/** The decks a system offers, in order. */
export const sizesOf = (sys: RiserSystem): RiserSize[] => Object.keys(RISER_SYSTEMS[sys].sizes)
export const systemOf = (i: Pick<PlotItem, 'system'>): RiserSystem => (i.system && i.system in RISER_SYSTEMS ? i.system : DEFAULT_SYSTEM)

/** Footprint in metres of a deck, for the stage plot. */
export function deckSize(sys: RiserSystem, size: RiserSize): { w: number; d: number } | undefined {
  return (RISER_SYSTEMS[sys].sizes as Record<string, { w: number; d: number }>)[size] ?? LEGACY_RISER_SIZES[size]
}

/** "200 × 100 cm", or "8 × 8 ft" for an old deck. */
export function sizeLabel(size: RiserSize): string {
  const [w, d] = size.split('x')
  if (LEGACY_RISER_SIZES[size]) return `${w} × ${d} ft`
  const cm = (m: string) => Math.round(Number(m) * 100)
  return `${cm(w)} × ${cm(d)} cm`
}

/** "40 cm", or "telescopic, 70 cm". */
export function legLabel(i: Pick<PlotItem, 'height' | 'telescopic'>): string {
  return i.telescopic ? tr('telescopic, {h} cm', { h: i.height ?? 0 }) : `${i.height ?? 0} cm`
}

/** One system's stock on a stage. Stock saved before systems counts as Prolyte. */
export function stockOf(stock: RiserStock | undefined, sys: RiserSystem): RiserSystemStock {
  const s = stock?.systems?.[sys]
  const legacy = sys === DEFAULT_SYSTEM && !stock?.systems?.[sys]
  return {
    decks: { ...(legacy ? stock?.decks : undefined), ...s?.decks },
    heights: s?.heights ?? (legacy ? stock?.heights : undefined) ?? [],
    telescopic: !!s?.telescopic,
  }
}

/** Size keys in a stable order: the system's decks first, then anything else (old decks). */
function keys(sys: RiserSystem, ...counts: DeckCount[]): RiserSize[] {
  const known = sizesOf(sys)
  const extra = [...new Set(counts.flatMap(c => Object.keys(c)))].filter(k => !known.includes(k)).sort()
  return [...known, ...extra]
}

const clean = (c: DeckCount): DeckCount => Object.fromEntries(Object.entries(c).filter(([, n]) => n))

export function needs(plot: Plot | undefined, sys: RiserSystem): { all: DeckCount; rolling: DeckCount; heights: number[]; telescopic: boolean } {
  const all: DeckCount = {}, rolling: DeckCount = {}
  const heights = new Set<number>()
  let telescopic = false
  for (const i of Object.values(plot?.items ?? {})) {
    if (i.kind !== 'riser' || !i.size || systemOf(i) !== sys) continue
    all[i.size] = (all[i.size] ?? 0) + 1
    if (i.rolling) rolling[i.size] = (rolling[i.size] ?? 0) + 1
    if (i.telescopic) telescopic = true
    else if (i.height) heights.add(i.height)
  }
  return { all, rolling, heights: [...heights].sort((a, b) => a - b), telescopic }
}

const add = (a: DeckCount, b: DeckCount): DeckCount => {
  const out: DeckCount = { ...a }
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + n
  return clean(out)
}

export interface RiserRow<T> {
  act: T
  need: DeckCount
  rolling: DeckCount
  /** Fixed leg heights this act uses. */
  heights: number[]
  /** Whether any of its risers stand on telescopic legs. */
  telescopic: boolean
  /** Decks in use while this act plays (its own, plus the next act's rolling risers being built). */
  inUse: DeckCount
  /** Decks short, per size, while this act plays. */
  short: DeckCount
  /** Fixed heights this act needs that the stage doesn't have legs for. */
  missingHeights: number[]
  /** It needs telescopic legs and the stage has none in this system. */
  missingTelescopic: boolean
  /** Changeover into this act: decks to bring on (+) or take off (−), per size. */
  change: DeckCount
}

/** `acts` in running order, each with its plot; one system at a time. */
export function planRisers<T>(acts: { act: T; plot: Plot | undefined }[], stock: RiserStock | undefined, sys: RiserSystem): RiserRow<T>[] {
  const have = stockOf(stock, sys)
  const legsKnown = have.heights.length > 0 || !!have.telescopic
  const n = acts.map(a => needs(a.plot, sys))
  return acts.map((a, i) => {
    const own = n[i]
    const inUse = add(own.all, n[i + 1]?.rolling ?? {})
    const short: DeckCount = {}
    for (const s of keys(sys, inUse)) { const gap = (inUse[s] ?? 0) - (have.decks[s] ?? 0); if (gap > 0) short[s] = gap }
    const prev = n[i - 1]?.all ?? {}
    const change: DeckCount = {}
    for (const s of keys(sys, own.all, prev)) { const d = (own.all[s] ?? 0) - (prev[s] ?? 0); if (d) change[s] = d }
    return {
      act: a.act, need: own.all, rolling: own.rolling, heights: own.heights, telescopic: own.telescopic, inUse, short,
      missingHeights: legsKnown ? own.heights.filter(h => !have.heights.includes(h)) : [],
      missingTelescopic: legsKnown && own.telescopic && !have.telescopic,
      change,
    }
  })
}

/** "3 of 2×1 m, 1 of 1×1 m"; signed: "+2 of 2×1 m, -1 of 1×1 m". */
export function deckText(c: DeckCount, sys: RiserSystem, signed = false): string {
  return keys(sys, c).filter(s => c[s]).map(s => tr('{n} of {size}', { n: `${signed && c[s] > 0 ? '+' : ''}${c[s]}`, size: sizeLabel(s) })).join(', ')
}

/** The most decks of each size in use at once over the day. */
export function peak(rows: RiserRow<unknown>[]): DeckCount {
  const out: DeckCount = {}
  for (const r of rows) for (const [s, n] of Object.entries(r.inUse)) out[s] = Math.max(out[s] ?? 0, n)
  return clean(out)
}
