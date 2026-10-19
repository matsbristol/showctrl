/*
 * Run sheet logic that the sample data and the data layer depend on.
 * The rest (now/next, shifting delays, lanes) comes with the run sheet port.
 */
import type { Artist, Ms, RosItem, Stage, Track } from '../types/model'
import { DEFAULT_TPL, KINDS, MIN } from './constants'

export const rid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

/** Effective start and end, with the delay applied. */
export const eff = (it: Pick<RosItem, 'start' | 'end' | 'delay'>) => ({
  s: it.start + (it.delay || 0),
  e: (it.end ?? it.start) + (it.delay || 0),
})

export const track = (it: Pick<RosItem, 'kind'>): Track => KINDS[it.kind]?.track ?? 'stage'

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
