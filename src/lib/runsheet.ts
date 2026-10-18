// Run sheet lookups, ported from the "lookups" section of public/showctrl.html.

import { KINDS, LEGACY_KINDS, MIN } from '../types/constants'
import type { DayKey, Id, Ms, RosItem, TimeZone, Track } from '../types/model'
import { festDay } from './time'

/** Effective start and end, with the delay applied. */
export function eff(it: Pick<RosItem, 'start' | 'end' | 'delay'>): { s: Ms; e: Ms } {
  const d = it.delay || 0
  return { s: it.start + d, e: (it.end ?? it.start) + d }
}

export function track(it: Pick<RosItem, 'kind'>): Track {
  return ({ ...KINDS, ...LEGACY_KINDS } as Record<string, { track: Track }>)[it.kind]?.track ?? 'stage'
}

/** A stage's items, optionally for one show day and one track, in planned order. */
export function itemsFor(ros: Readonly<Record<Id, RosItem>>, sid: Id, tz: TimeZone, day?: DayKey | null, tr?: Track | null): RosItem[] {
  return Object.values(ros)
    .filter(i => i.stage === sid && (!day || festDay(i.start, tz) === day) && (!tr || track(i) === tr))
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

/** Items that a delay on `item` moves: it and everything after it that day, not done. */
export function shiftTargets(ros: Readonly<Record<Id, RosItem>>, item: RosItem, tz: TimeZone, dockToo = true): RosItem[] {
  return itemsFor(ros, item.stage, tz, festDay(item.start, tz))
    .filter(x => x.start >= item.start && x.status !== 'done' && (dockToo || track(x) === 'stage'))
}

/** How far behind (positive) or ahead (negative) a stage runs, from its now or next item. */
export function stageDelay(ros: Readonly<Record<Id, RosItem>>, sid: Id, t: Ms, tz: TimeZone): number {
  const { cur, next } = nowNext(ros, sid, t, tz)
  return next?.delay || cur?.delay || 0
}

/** Packs timeline blocks into rows so they don't overlap. Returns [item, row] pairs. */
export function packRows(items: RosItem[]): { out: [RosItem, number][]; rows: number } {
  const ends: number[] = []
  const out: [RosItem, number][] = []
  for (const i of [...items].sort((a, b) => eff(a).s - eff(b).s)) {
    const e = eff(i)
    let r = ends.findIndex(end => end <= e.s)
    if (r < 0) { r = ends.length; ends.push(0) }
    ends[r] = Math.max(e.e, e.s + 10 * MIN)
    out.push([i, r])
  }
  return { out, rows: Math.max(1, ends.length) }
}

/**
 * A stage's "now" is the live on-stage item (or the one running by the clock).
 * Its "next" is the next show not yet done.
 */
export function nowNext(ros: Readonly<Record<Id, RosItem>>, sid: Id, t: Ms, tz: TimeZone): { cur?: RosItem; next?: RosItem } {
  const items = itemsFor(ros, sid, tz, null, 'stage')
    .filter(i => i.kind !== 'access' && i.kind !== 'curfew')
    .sort((a, b) => eff(a).s - eff(b).s)
  const cur = items.find(i => i.status === 'live') ?? items.find(i => i.status !== 'done' && eff(i).s <= t && eff(i).e > t)
  const after = cur ? eff(cur).s : t - MIN
  const next = items.find(i => i.kind === 'show' && i !== cur && i.status !== 'done' && eff(i).s > after)
  return { cur, next }
}
