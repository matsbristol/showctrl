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
