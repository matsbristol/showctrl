// Riser planning: what each act's stage plot needs, against the stage's stock.
//
// Rolling risers are built off stage while the act before is still playing, so during that
// show both acts' decks are in use: the current act's, plus the next act's rolling ones.

import { RISER_SIZES } from '../types/constants'
import type { Plot, RiserSize, RiserStock } from '../types/model'

export type DeckCount = Partial<Record<RiserSize, number>>
export const SIZES = Object.keys(RISER_SIZES) as RiserSize[]

export function needs(plot: Plot | undefined): { all: DeckCount; rolling: DeckCount; heights: number[] } {
  const all: DeckCount = {}, rolling: DeckCount = {}
  const heights = new Set<number>()
  for (const i of Object.values(plot?.items ?? {})) {
    if (i.kind !== 'riser' || !i.size) continue
    all[i.size] = (all[i.size] ?? 0) + 1
    if (i.rolling) rolling[i.size] = (rolling[i.size] ?? 0) + 1
    if (i.height) heights.add(i.height)
  }
  return { all, rolling, heights: [...heights].sort((a, b) => a - b) }
}

const add = (a: DeckCount, b: DeckCount): DeckCount => Object.fromEntries(SIZES.map(s => [s, (a[s] ?? 0) + (b[s] ?? 0)]).filter(([, n]) => n)) as DeckCount

export interface RiserRow<T> {
  act: T
  need: DeckCount
  rolling: DeckCount
  heights: number[]
  /** Decks in use while this act plays (its own, plus the next act's rolling risers being built). */
  inUse: DeckCount
  /** Decks short, per size, while this act plays. */
  short: DeckCount
  /** Heights this act needs that the stage doesn't have legs for. */
  missingHeights: number[]
  /** Changeover into this act: decks to bring on (+) or take off (−), per size. */
  change: DeckCount
}

/** `acts` in running order, each with its plot. */
export function planRisers<T>(acts: { act: T; plot: Plot | undefined }[], stock: RiserStock | undefined): RiserRow<T>[] {
  const n = acts.map(a => needs(a.plot))
  return acts.map((a, i) => {
    const own = n[i]
    const nextRolling = n[i + 1]?.rolling ?? {}
    const inUse = add(own.all, nextRolling)
    const short: DeckCount = {}
    for (const s of SIZES) { const gap = (inUse[s] ?? 0) - (stock?.decks[s] ?? 0); if (gap > 0) short[s] = gap }
    const prev = n[i - 1]?.all ?? {}
    const change: DeckCount = {}
    for (const s of SIZES) { const d = (own.all[s] ?? 0) - (prev[s] ?? 0); if (d) change[s] = d }
    return {
      act: a.act, need: own.all, rolling: own.rolling, heights: own.heights, inUse, short,
      missingHeights: stock?.heights?.length ? own.heights.filter(h => !stock.heights.includes(h)) : [],
      change,
    }
  })
}

export function deckText(c: DeckCount, signed = false): string {
  return SIZES.filter(s => c[s]).map(s => `${signed && (c[s] ?? 0) > 0 ? '+' : ''}${c[s]} × ${s}`).join(', ')
}

/** The most decks of each size in use at once over the day. */
export function peak(rows: RiserRow<unknown>[]): DeckCount {
  const out: DeckCount = {}
  for (const r of rows) for (const s of SIZES) out[s] = Math.max(out[s] ?? 0, r.inUse[s] ?? 0)
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v)) as DeckCount
}
