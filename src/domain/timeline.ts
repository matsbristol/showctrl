/*
 * Layout maths for the lanes timeline: which hours to show, and how to stack
 * overlapping items into rows so none hide each other.
 */
import type { DayKey, Ms, RosItem, TimeZone } from '../types/model'
import { HOUR, MIN } from './constants'
import { eff } from './runsheet'
import { fromLocal } from './time'

/** Items shorter than this are drawn as a mark (a dashed line), not a block. */
export const POINT_MAX = 5 * MIN

export const isPoint = (i: RosItem) => eff(i).e - eff(i).s < POINT_MAX

/**
 * The visible window: every item plus 30 minutes either side, on whole
 * hours, at least six hours wide. An empty day shows 12:00–18:00.
 */
export function timelineRange(items: RosItem[], day: DayKey, tz?: TimeZone): { lo: Ms; hi: Ms } {
  let lo: Ms, hi: Ms
  if (items.length) {
    lo = Math.min(...items.map(i => eff(i).s))
    hi = Math.max(...items.map(i => eff(i).e))
  } else {
    lo = fromLocal(`${day}T12:00`, tz)!
    hi = lo + 6 * HOUR
  }
  lo = Math.floor((lo - 30 * MIN) / HOUR) * HOUR
  hi = Math.ceil((hi + 30 * MIN) / HOUR) * HOUR
  if (hi - lo < 6 * HOUR) hi = lo + 6 * HOUR
  return { lo, hi }
}

/**
 * Greedy row packing: each item goes in the first row that is free when it
 * starts. Every block is treated as at least 10 minutes long so short
 * neighbours don't overlap their labels.
 */
export function packRows(items: RosItem[]): { rows: [RosItem, number][]; count: number } {
  const ends: Ms[] = []
  const rows: [RosItem, number][] = []
  for (const i of [...items].sort((a, b) => eff(a).s - eff(b).s)) {
    const e = eff(i)
    let r = ends.findIndex(end => end <= e.s)
    if (r < 0) {
      r = ends.length
      ends.push(0)
    }
    ends[r] = Math.max(e.e, e.s + 10 * MIN)
    rows.push([i, r])
  }
  return { rows, count: Math.max(1, ends.length) }
}
