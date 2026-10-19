/*
 * Run sheet logic shared by the sample data, the shell and (later) the run
 * sheet screens. Shifting delays and the lanes timeline come with the run
 * sheet port.
 */
import type { Artist, DayKey, Id, Ms, RosItem, Stage, TimeZone, Track } from '../types/model'
import { DEFAULT_TPL, KINDS, MIN } from './constants'
import { festDay } from './time'

export const rid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

/** Effective start and end, with the delay applied. */
export const eff = (it: Pick<RosItem, 'start' | 'end' | 'delay'>) => ({
  s: it.start + (it.delay || 0),
  e: (it.end ?? it.start) + (it.delay || 0),
})

export const track = (it: Pick<RosItem, 'kind'>): Track => KINDS[it.kind]?.track ?? 'stage'

/** A stage's items, optionally for one festival day and one track, in running order. */
export function itemsFor(ros: Record<Id, RosItem>, sid: Id, opts: { day?: DayKey; track?: Track; tz?: TimeZone } = {}): RosItem[] {
  return Object.values(ros)
    .filter(i => i.stage === sid && (!opts.day || festDay(i.start, opts.tz) === opts.day) && (!opts.track || track(i) === opts.track))
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

/**
 * What is on stage now, and the next show.
 * "Now" is the item marked live, or else whichever on-stage item spans `t`.
 * Stage access and curfew are points in time, not things that are "on".
 * "Next" is the next show not yet done, after the current item (or after now).
 */
export function nowNext(ros: Record<Id, RosItem>, sid: Id, t: Ms): { cur?: RosItem; next?: RosItem } {
  const items = itemsFor(ros, sid, { track: 'stage' })
    .filter(i => i.kind !== 'access' && i.kind !== 'curfew')
    .sort((a, b) => eff(a).s - eff(b).s)
  const cur = items.find(i => i.status === 'live') ?? items.find(i => i.status !== 'done' && eff(i).s <= t && eff(i).e > t)
  const after = cur ? eff(cur).s : t - MIN
  const next = items.find(i => i.kind === 'show' && i !== cur && i.status !== 'done' && eff(i).s > after)
  return { cur, next }
}

export const itemsForArtist = (ros: Record<Id, RosItem>, aid: Id) =>
  Object.values(ros).filter(i => i.artist === aid).sort((a, b) => a.start - b.start)

export const showsFor = (ros: Record<Id, RosItem>, aid: Id) => itemsForArtist(ros, aid).filter(i => i.kind === 'show')

/** How far behind (positive) or ahead (negative) a stage is running, from its current or next item. */
export function stageDelay(ros: Record<Id, RosItem>, sid: Id, t: Ms): Ms {
  const { cur, next } = nowNext(ros, sid, t)
  return next?.delay || cur?.delay || 0
}

/* ---------------- changes ----------------
 * Run sheet operations return a list of changes instead of writing, so they
 * can be tested on their own and applied by the UI in one place.
 */

export type Change =
  | { col: 'ros'; id: Id; patch: Partial<Omit<RosItem, 'id'>> }
  | { col: 'artists'; id: Id; patch: Partial<Omit<Artist, 'id'>> }

/** Minimum gap before going on stage or finishing is called "late" / "early" / "overran". */
export const LATE_THRESHOLD = 2 * MIN

const roundToMin = (ms: Ms) => Math.round(ms / MIN) * MIN

/**
 * Delay an item and everything after it on that stage and festival day.
 * Finished items stay where they were. With `dockToo` false, dock and
 * backstage items (load in, load out, departures) keep their times.
 */
export function shiftFrom(ros: Record<Id, RosItem>, item: RosItem, deltaMs: Ms, opts: { note?: string; dockToo?: boolean; tz?: TimeZone } = {}): Change[] {
  const { note, dockToo = true, tz } = opts
  return itemsFor(ros, item.stage, { day: festDay(item.start, tz), tz })
    .filter(x => x.start >= item.start && x.status !== 'done' && (dockToo || track(x) === 'stage'))
    .map(x => ({
      col: 'ros' as const,
      id: x.id,
      patch: { delay: (x.delay || 0) + deltaMs, ...(x.id === item.id && note ? { delayNote: note } : {}) },
    }))
}

/** Every delay on a stage's day back to zero. */
export function resetDelays(ros: Record<Id, RosItem>, sid: Id, day: DayKey, tz?: TimeZone): Change[] {
  return itemsFor(ros, sid, { day, tz })
    .filter(x => x.delay)
    .map(x => ({ col: 'ros' as const, id: x.id, patch: { delay: 0, delayNote: '' } }))
}

/** A suggested follow-up shift, offered to the user after going on or finishing off time. */
export interface ShiftOffer {
  message: string
  label: string
  changes: Change[]
}

/**
 * "On stage" / "Start": the item goes live and records when. Only one thing
 * can be live on stage, so any other live on-stage item is finished. A show
 * also moves its artist to "on stage". If a show starts 2+ minutes off its
 * time, offer to shift the rest of the day by the same amount.
 */
export function goLive(ros: Record<Id, RosItem>, item: RosItem, t: Ms, tz?: TimeZone): { changes: Change[]; offer?: ShiftOffer } {
  const changes: Change[] = []
  if (track(item) === 'stage') {
    for (const x of itemsFor(ros, item.stage, { track: 'stage' })) {
      if (x.status === 'live' && x.id !== item.id) changes.push({ col: 'ros', id: x.id, patch: { status: 'done' } })
    }
  }
  changes.push({ col: 'ros', id: item.id, patch: { status: 'live', actual: t } })
  if (item.kind === 'show' && item.artist) changes.push({ col: 'artists', id: item.artist, patch: { status: 'on stage' } })

  const diff = t - eff(item).s
  if (item.kind !== 'show' || Math.abs(diff) < LATE_THRESHOLD) return { changes }
  const mins = Math.round(Math.abs(diff) / MIN)
  const late = diff > 0
  return {
    changes,
    offer: {
      message: `${item.title} went on ${mins} min ${late ? 'late' : 'early'}.`,
      label: `Shift the rest ${late ? '+' : '−'}${mins} min`,
      changes: shiftFrom(ros, item, roundToMin(diff), { note: late ? 'Started late' : 'Started early', tz }),
    },
  }
}

/**
 * "Done": the item finishes and records when. A show moves its artist to
 * "done". If a show overran by 2+ minutes, offer to push the next
 * unfinished item (and everything after it) by the overrun.
 */
export function markDone(ros: Record<Id, RosItem>, item: RosItem, t: Ms, tz?: TimeZone): { changes: Change[]; offer?: ShiftOffer } {
  const changes: Change[] = [{ col: 'ros', id: item.id, patch: { status: 'done', actualEnd: t } }]
  if (item.kind === 'show' && item.artist) changes.push({ col: 'artists', id: item.artist, patch: { status: 'done' } })

  const over = t - eff(item).e
  if (item.kind !== 'show' || over < LATE_THRESHOLD) return { changes }
  const next = itemsFor(ros, item.stage, { day: festDay(item.start, tz), tz }).find(x => x.start > item.start && x.status !== 'done' && x.id !== item.id)
  if (!next) return { changes }
  const mins = Math.round(over / MIN)
  return {
    changes,
    offer: {
      message: `${item.title} overran by ${mins} min.`,
      label: `Shift the rest +${mins} min`,
      changes: shiftFrom(ros, next, roundToMin(over), { note: `${item.title} overran`, tz }),
    },
  }
}

/** Builds a full artist day from the stage's template: eight items, plus a soundcheck if given. */
export function buildDaySheet(stage: Stage, artist: Artist, showStart: Ms, showEnd: Ms, soundcheck?: Ms | null): RosItem[] {
  const tp = { ...DEFAULT_TPL, ...stage.template }
  const m = (n: number) => n * MIN
  const mk = (kind: RosItem['kind'], start: Ms, end: Ms, title = artist.name): RosItem =>
    ({ id: rid(), stage: stage.id, artist: artist.id, kind, title, start, end, status: 'pending', delay: 0, notes: '' })
  const out = [
    mk('arrival', showStart + m(tp.arrival), showStart + m(tp.arrival) + m(15)),
    mk('getin', showStart + m(tp.getin), showStart + m(tp.getin) + m(15)),
    mk('loadin', showStart + m(tp.loadin), showStart + m(tp.loadin) + m(tp.loadinDur)),
    mk('access', showStart + m(tp.access), showStart + m(tp.access)),
    mk('changeover', showStart - m(tp.changeover), showStart, `Changeover → ${artist.name}`),
    mk('show', showStart, showEnd),
    mk('loadout', showEnd + m(tp.loadoutAfter), showEnd + m(tp.loadoutAfter) + m(tp.loadoutDur)),
    mk('departure', showEnd + m(tp.departure), showEnd + m(tp.departure) + m(15)),
  ]
  if (soundcheck) out.push(mk('soundcheck', soundcheck, soundcheck + m(tp.soundcheckDur)))
  return out
}
