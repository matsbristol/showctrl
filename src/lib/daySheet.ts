import { DEFAULT_TPL, MIN } from '../types/constants'
import type { Id, Ms, RosItem, RosKind, Stage } from '../types/model'
import { rid } from './id'

/**
 * Generates an artist's day sheet from the stage's template: arrival, get in, load in,
 * stage access, changeover, show, load out and departure, plus a soundcheck if given.
 */
export function buildDaySheet(
  stage: Pick<Stage, 'id' | 'template'>,
  artist: { id: Id; name: string },
  showStart: Ms,
  showEnd: Ms,
  soundcheck?: Ms | null,
): RosItem[] {
  const tp = { ...DEFAULT_TPL, ...stage.template }
  const m = (n: number) => n * MIN
  const nm = artist.name
  const mk = (kind: RosKind, start: Ms, end: Ms, title = nm): RosItem =>
    ({ id: rid(), stage: stage.id, artist: artist.id, kind, title, start, end, status: 'pending', delay: 0, notes: '' })
  const out = [
    mk('arrival', showStart + m(tp.arrival), showStart + m(tp.arrival) + m(15)),
    mk('getin', showStart + m(tp.getin), showStart + m(tp.getin) + m(15)),
    mk('loadin', showStart + m(tp.loadin), showStart + m(tp.loadin) + m(tp.loadinDur)),
    mk('access', showStart + m(tp.access), showStart + m(tp.access)),
    mk('changeover', showStart - m(tp.changeover), showStart, `Changeover → ${nm}`),
    mk('show', showStart, showEnd),
    mk('loadout', showEnd + m(tp.loadoutAfter), showEnd + m(tp.loadoutAfter) + m(tp.loadoutDur)),
    mk('departure', showEnd + m(tp.departure), showEnd + m(tp.departure) + m(15)),
  ]
  if (soundcheck) out.push(mk('soundcheck', soundcheck, soundcheck + m(tp.soundcheckDur)))
  return out
}
