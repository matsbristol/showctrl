import { Link } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { aOrAn } from '../../lib/text'
import type { Id } from '../../types/model'
import { ActPicker } from '../acts/ActPicker'
import { useActs, useSelectedAct } from '../acts/acts'
import { DaySelector } from '../DaySelector'
import { PlotEditor } from '../plots/PlotEditor'
import { useTerms } from '../session'
import { tr } from '../../i18n'

export function PlotsPage({ sid }: { sid: Id | null }) {
  const t = useTerms()
  const plots = useCollection('plots')
  const acts = useActs(sid)
  const [sel, select] = useSelectedAct(acts)
  return (
    <>
      <div className="head no-print">
        <div><h1>{tr('Stage plots')}</h1><p>{tr('To scale, seen from FOH. Add items, drag them into place, and give risers their deck size and height. The riser planner reads these.')}</p></div>
        <div className="actions"><DaySelector /><button type="button" className="btn" onClick={() => window.print()}>{tr('Print')}</button></div>
      </div>
      <div className="split">
        <div className="no-print">
          <ActPicker acts={acts} selected={sel?.id ?? null} onSelect={select} badge={x => { const n = Object.keys(plots[x.id]?.items ?? {}).length; return n ? `${n}` : '—' }} />
        </div>
        {sel ? (
          <div className="stack" style={{ gap: '.75rem', minWidth: 0 }}>
            <h2><Link to={`/s/${sel.stage}/artists/${sel.id}`} style={{ color: 'inherit' }}>{sel.name}</Link></h2>
            <PlotEditor key={sel.id} artist={sel} />
          </div>
        ) : <div className="panel"><p className="empty">{tr('Choose {a_performer}.', { a_performer: aOrAn(t.performer.toLowerCase()), performer: t.performer.toLowerCase() })}</p></div>}
      </div>
    </>
  )
}
