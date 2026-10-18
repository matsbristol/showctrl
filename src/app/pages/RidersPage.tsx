import { useState } from 'react'
import { useCollection } from '../../data/hooks'
import { openItems, riderId } from '../../lib/riders'
import type { Id, RiderKind } from '../../types/model'
import { RiderPanel } from '../riders/RiderPanel'
import { useAccess, useTerms } from '../session'

/** Technical and hospitality riders for every visible performer (HQ) or one stage. */
export function RidersPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const artists = useCollection('artists')
  const riders = useCollection('riders')
  const stages = useCollection('stages')
  const kinds = (['tech', 'hosp'] as RiderKind[]).filter(k => a.lv(k === 'tech' ? 'riders_tech' : 'riders_hosp', sid) >= 1)
  const [kindState, setKind] = useState<RiderKind>(kinds[0] ?? 'tech')
  const kind = kinds.includes(kindState) ? kindState : kinds[0]
  const [fsState, setFs] = useState('')
  const fs = sid ?? fsState
  const list = Object.values(artists)
    .filter(x => (!fs || x.stage === fs) && (sid || a.canSeeStage(x.stage)))
    .sort((x, y) => x.name.localeCompare(y.name))
  const open = list.reduce((n, x) => n + openItems(riders[riderId(x.id, kind)]), 0)

  return (
    <>
      <div className="head">
        <div>
          <h1>{sid ? `Riders · ${stages[sid]?.name}` : 'Riders'}</h1>
          <p>Paste a rider in line by line, then assign each item to the department that sources it.</p>
        </div>
        {!sid && (
          <div className="actions">
            <select className="inline-sel" aria-label="Stage" value={fsState} onChange={e => setFs(e.target.value)}>
              <option value="">All stages</option>
              {a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="tabs" role="tablist">
        {kinds.map(k => (
          <button key={k} type="button" role="tab" aria-selected={k === kind} onClick={() => setKind(k)}>
            {k === 'tech' ? 'Technical riders' : 'Hospitality riders'}
          </button>
        ))}
        <span className="small muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>{open} open item{open === 1 ? '' : 's'}</span>
      </div>
      <div className="grid g2">
        {kind && list.map(x => <RiderPanel key={`${x.id}_${kind}`} artistId={x.id} kind={kind} />)}
        {!list.length && <div className="panel"><p className="empty">No {t.performers.toLowerCase()} here yet.</p></div>}
      </div>
    </>
  )
}
