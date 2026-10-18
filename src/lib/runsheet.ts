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
