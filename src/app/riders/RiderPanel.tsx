import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { nextOrder, parseRiderLines, riderId, riderItems, riderProgress } from '../../lib/riders'
import { RIDER_STATUS } from '../../types/constants'
import type { Id, RiderKind, RiderStatus } from '../../types/model'
import { useAccess } from '../session'
import { useServerTime } from '../time'
import { Field, FormDialog } from '../ui/Dialog'
import { tr } from '../../i18n'

const KIND_LABEL: Record<RiderKind, string> = { tech: 'Technical', hosp: 'Hospitality' }
const STATUS_CHIP: Record<RiderStatus, string> = { sourced: 'go', declined: 'st', agreed: 'ac', requested: 'sb' }

/** One performer's technical or hospitality rider: progress, and status and department per item. On the artist's own page, pass `onArtistPage`. */
export function RiderPanel({ artistId, kind, onArtistPage }: { artistId: Id; kind: RiderKind; onArtistPage?: boolean }) {
  const a = useAccess()
  const store = useStore()
  const cfg = useConfig('event')
  const artists = useCollection('artists')
  const riders = useCollection('riders')
  const serverNow = useServerTime()
  const [adding, setAdding] = useState(false)
  const artist = artists[artistId]
  const id = riderId(artistId, kind)
  const r = riders[id]
  const items = riderItems(r)
  const { done, total } = riderProgress(r)
  const w = a.canW(kind === 'tech' ? 'riders_tech' : 'riders_hosp', artist?.stage)
  const dept = (d?: Id | null) => cfg?.depts.find(x => x.id === d)?.name ?? ''

  // Only the changed item is written, so parallel edits to other items survive.
  const change = (itemId: Id, patch: { status?: RiderStatus; dept?: Id | null }) =>
    store.update('riders', id, { items: { [itemId]: patch }, updated: serverNow() })
  const removeItem = (itemId: Id) => store.update('riders', id, { items: { [itemId]: undefined }, updated: serverNow() })

  return (
    <section className="panel rider">
      <div className="ph">
        {onArtistPage
          ? <h3>{tr(kind === 'tech' ? 'Technical rider' : 'Hospitality rider')}</h3>
          : <><span className={`chip ${kind === 'tech' ? 'ac' : 'go'}`}>{tr(KIND_LABEL[kind])}</span><h3>{artist?.name ?? tr('Removed')}</h3></>}
        {total > 0 && (
          <div className="row" title={tr('{done} of {total} settled', { done, total })}>
            <div className="bar"><i style={{ width: `${Math.round(done / total * 100)}%` }} /></div>
            <span className="small num">{done}/{total}</span>
          </div>
        )}
        {w && <div className="actions"><button type="button" className="btn sm" onClick={() => setAdding(true)}>{tr('+ Add items')}</button></div>}
      </div>
      {items.length ? (
        <ul className="items">
          {items.map(it => (
            <li key={it.id} className={it.status}>
              <span className="tx">{it.text}</span>
              {w ? (
                <>
                  <select className="inline-sel" aria-label={tr('Department for {item}', { item: it.text })} value={it.dept ?? ''} onChange={e => void change(it.id, { dept: e.target.value || null })}>
                    <option value="">{tr('Unassigned')}</option>
                    {cfg?.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select className="inline-sel" aria-label={tr('Status of {name}', { name: it.text })} value={it.status} onChange={e => void change(it.id, { status: e.target.value as RiderStatus })}>
                    {RIDER_STATUS.map(s => <option key={s} value={s}>{tr(s)}</option>)}
                  </select>
                  <button type="button" className="btn sm danger" aria-label={tr('Remove {item}', { item: it.text })} onClick={() => { if (confirm(tr('Remove “{item}”?', { item: it.text }))) void removeItem(it.id) }}>×</button>
                </>
              ) : (
                <>
                  <span className="small">{dept(it.dept)}</span>
                  <span className={`chip ${STATUS_CHIP[it.status]}`}>{tr(it.status)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="empty">{tr(kind === 'tech' ? 'No technical rider items yet.' : 'No hospitality rider items yet.')}</p>}
      {adding && artist && <RiderAddForm artistId={artistId} artistName={artist.name} kind={kind} onClose={() => setAdding(false)} />}
    </section>
  )
}

/** Paste a rider in, one item per line. */
function RiderAddForm({ artistId, artistName, kind, onClose }: { artistId: Id; artistName: string; kind: RiderKind; onClose: () => void }) {
  const store = useStore()
  const cfg = useConfig('event')
  const serverNow = useServerTime()
  const [lines, setLines] = useState('')
  const [dept, setDept] = useState(kind === 'hosp' && cfg?.depts.some(d => d.id === 'hosp') ? 'hosp' : '')
  return (
    <FormDialog
      title={tr(kind === 'tech' ? 'Add technical items · {name}' : 'Add hospitality items · {name}', { name: artistName })}
      saveLabel={tr('Add items')}
      onClose={onClose}
      onSave={async () => {
        const id = riderId(artistId, kind)
        const r = store.peek('riders')?.[id]
        const items = parseRiderLines(lines, dept || null, nextOrder(r))
        if (!Object.keys(items).length) return tr('Add at least one line.')
        if (r) await store.update('riders', id, { items, updated: serverNow() })
        else await store.set('riders', id, { artist: artistId, kind, items, updated: serverNow() })
      }}
    >
      <Field label={tr('One item per line')} full>
        <textarea
          value={lines}
          onChange={e => setLines(e.target.value)}
          placeholder={kind === 'tech' ? tr('Drum riser 8×8 ft, 60 cm high\n4 × wedge monitors on separate mixes') : tr('Hot meal for 8 (1 vegan)\n12 × still water')}
        />
      </Field>
      <Field label={tr('Department')}>
        <select value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">{tr('Unassigned')}</option>
          {cfg?.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
    </FormDialog>
  )
}
