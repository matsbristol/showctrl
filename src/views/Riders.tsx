/*
 * Riders, in HQ (filter by stage) or for one stage, as two tabs: technical
 * and hospitality. Only the tabs the viewer may see are shown; stage crew,
 * for example, see technical riders only.
 */
import { useState } from 'react'
import { artistsFor } from '../domain/artists'
import { RIDER_LABEL, riderId, riderPerm, riderProgress } from '../domain/riders'
import { sortStages } from '../access/access'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import type { Id, RiderKind } from '../types/model'
import { Head } from './common'
import { useEvent } from './hooks'
import { RiderPanel } from './RiderPanel'

const KINDS: RiderKind[] = ['tech', 'hosp']

export function Riders({ sid }: { sid: Id | null }) {
  const snap = useSnapshot()
  const access = useAccess()
  const { T } = useEvent()
  const kinds = KINDS.filter(k => access.lv(riderPerm(k), sid) >= 1)
  const [picked, setPicked] = useState<RiderKind>(kinds[0] ?? 'tech')
  const kind = kinds.includes(picked) ? picked : kinds[0]
  const [stageFilter, setStageFilter] = useState('')
  const artists = artistsFor(snap.col.artists, sid ?? (stageFilter || null), access.canSeeStage)
  const open = artists.reduce((n, a) => n + riderProgress(snap.col.riders[riderId(a.id, kind)]?.items ?? []).open, 0)

  return (
    <>
      <Head
        title={sid ? `Riders · ${snap.col.stages[sid]?.name}` : 'Riders'}
        sub="Paste a rider in line by line, then assign each item to the department that sources it."
        actions={!sid && (
          <select className="inline-sel" aria-label={T.stage} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All {T.stages.toLowerCase()}</option>
            {sortStages(Object.values(snap.col.stages)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      />
      <div className="tabs" role="tablist">
        {kinds.map(k => (
          <button key={k} type="button" role="tab" aria-selected={k === kind} onClick={() => setPicked(k)}>{RIDER_LABEL[k]} riders</button>
        ))}
        <span className="small muted push self-center">{open} open item{open === 1 ? '' : 's'}</span>
      </div>
      <div className="grid g2" role="tabpanel">
        {artists.length
          ? artists.map(a => <RiderPanel key={a.id} artist={a.id} kind={kind} />)
          : <div className="panel"><p className="empty">No {T.performers.toLowerCase()} here yet.</p></div>}
      </div>
    </>
  )
}
