import { useSearchParams } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { festDay } from '../../lib/time'
import type { Artist, Id } from '../../types/model'
import { useDay } from '../day'
import { useAccess, useTz } from '../session'

export interface ActRow { artist: Artist; show: number | null }

/** Acts on the selected day (stage-limited), by show time, then acts with no show that day. */
export function useActs(sid: Id | null): ActRow[] {
  const a = useAccess()
  const tz = useTz()
  const [day] = useDay()
  const artists = useCollection('artists')
  const ros = useCollection('ros')
  const shows = new Map<Id, number>()
  for (const i of Object.values(ros)) if (i.kind === 'show' && i.artist && festDay(i.start, tz) === day) shows.set(i.artist, eff(i).s)
  return Object.values(artists)
    .filter(x => (sid ? x.stage === sid : a.canSeeStage(x.stage)))
    .map(artist => ({ artist, show: shows.get(artist.id) ?? null }))
    .sort((x, y) => (x.show == null ? 1 : 0) - (y.show == null ? 1 : 0) || (x.show ?? 0) - (y.show ?? 0) || x.artist.name.localeCompare(y.artist.name))
}

export function useSelectedAct(acts: ActRow[]): [Artist | null, (id: Id) => void] {
  const [params, setParams] = useSearchParams()
  const want = params.get('act')
  const sel = acts.find(x => x.artist.id === want)?.artist ?? acts.find(x => x.show != null)?.artist ?? acts[0]?.artist ?? null
  return [sel, id => setParams(p => { p.set('act', id); return p }, { replace: true })]
}
