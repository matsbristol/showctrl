import { useState } from 'react'
import { useCollection, useConfig, useDoc } from '../../data/hooks'
import { relTime } from '../../lib/time'
import { moduleOn } from '../../shared/modules'
import { personName } from '../../shared/people'
import type { Artist } from '../../types/model'
import { useAccess, useNow } from '../session'
import { RiskBadge } from './RiskChip'
import { RiskForm } from './RiskForm'
import { tr } from '../../i18n'

/** The artist page's risk panel. */
export function RiskPanel({ artist }: { artist: Artist }) {
  const a = useAccess()
  const cfg = useConfig('event')
  const risk = useDoc('risks', artist.id)
  const members = useCollection('members')
  const people = useCollection('people')
  const now = useNow(60_000)
  const [editing, setEditing] = useState(false)
  if (!moduleOn(cfg, 'risk') || a.lv('risk', artist.stage) < 1) return null
  const w = a.canW('risk', artist.stage)
  return (
    <section className={`panel risk-panel${risk ? ` risk-${risk.level}` : ''}`}>
      <div className="ph">
        <h3>{tr('Risk assessment')}</h3>
        <RiskBadge level={risk?.level ?? null} />
        {w && <div className="actions"><button type="button" className="btn sm" onClick={() => setEditing(true)}>{risk ? tr('Edit') : tr('Assess')}</button></div>}
      </div>
      {risk ? (
        <div className="pb stack">
          {risk.factors.length > 0 && <div className="row">{risk.factors.map(f => <span key={f} className="chip">{tr(f)}</span>)}</div>}
          {risk.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{risk.notes}</p>}
          {risk.at && <span className="small muted">{tr('Assessed by {name} · {time}', { name: personName(risk.by, members, people), time: relTime(risk.at, now) })}</span>}
        </div>
      ) : <p className="empty">{tr('Not assessed yet.')}</p>}
      {editing && <RiskForm artist={artist} onClose={() => setEditing(false)} />}
    </section>
  )
}
