/*
 * One artist's technical or hospitality rider: progress, and each item
 * with its department and status. Editable by whoever can edit that kind
 * of rider on the artist's stage.
 */
import { RIDER_STATUS } from '../domain/constants'
import { deptName } from '../domain/people'
import { RIDER_LABEL, riderId, riderPerm, riderProgress, riderTone } from '../domain/riders'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { Icon } from '../shell/Icon'
import type { Id, RiderItemStatus, RiderKind } from '../types/model'
import { useRiderActions } from './riderActions'

export function RiderPanel({ artist, kind, showName = true }: { artist: Id; kind: RiderKind; showName?: boolean }) {
  const snap = useSnapshot()
  const access = useAccess()
  const act = useRiderActions()
  const a = snap.col.artists[artist]
  const r = snap.col.riders[riderId(artist, kind)]
  const items = r?.items ?? []
  const depts = snap.cfg?.depts ?? []
  const canEdit = access.canW(riderPerm(kind), a?.stage)
  const { settled, total } = riderProgress(items)
  const label = RIDER_LABEL[kind]

  return (
    <section className="panel rider" aria-label={`${label} rider · ${a?.name ?? ''}`}>
      <div className="ph">
        <span className={`chip ${kind === 'tech' ? 'ac' : 'go'}`}>{label}</span>
        <h3>{showName ? a?.name : 'Rider'}</h3>
        {total > 0 && (
          <div className="row" title={`${settled} of ${total} sourced or declined`}>
            <div className="bar"><i style={{ width: `${Math.round(settled / total * 100)}%` }} /></div>
            <span className="small num">{settled}/{total}</span>
          </div>
        )}
        {canEdit && <div className="actions"><button type="button" className="btn sm" onClick={() => act.addItems(artist, kind)}><Icon name="plus" />Add items</button></div>}
      </div>
      {items.length ? (
        <ul className="items">
          {items.map(it => (
            <li key={it.id} className={it.status}>
              <span className="tx">{it.text}</span>
              {canEdit ? (
                <>
                  <select className="inline-sel" value={it.dept ?? ''} aria-label={`Department for ${it.text}`} onChange={e => act.changeItem(artist, kind, it.id, { dept: e.target.value || undefined })}>
                    <option value="">Unassigned</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select className="inline-sel" value={it.status} aria-label={`Status of ${it.text}`} onChange={e => act.changeItem(artist, kind, it.id, { status: e.target.value as RiderItemStatus })}>
                    {RIDER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" className="btn sm icon" aria-label={`Remove ${it.text}`} onClick={() => act.removeItem(artist, kind, it.id)}>×</button>
                </>
              ) : (
                <>
                  <span className="small">{deptName(depts, it.dept)}</span>
                  <span className={`chip ${riderTone(it.status)}`}>{it.status}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="empty">No {label.toLowerCase()} rider items yet.</p>}
    </section>
  )
}
