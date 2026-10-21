import { useState } from 'react'
import { useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { LOCATION_KINDS } from '../../types/constants'
import type { Id, Location, LocationKind } from '../../types/model'
import { useAccess, useTerms } from '../session'
import { Field, FormDialog } from '../ui/Dialog'

/** A place trucks are sent to. Stage managers add their own stage's; festival-wide places need festival schedule rights. */
export function LocationForm({ location, sid, onClose }: { location: Location | null; sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const l = location
  const stageOpts = a.stagesSorted().filter(s => a.canW('schedule', s.id))
  const [v, setV] = useState({
    name: l?.name ?? '', kind: (l?.kind ?? 'loadbay') as LocationKind,
    stage: l ? l.stage ?? '' : sid ?? (a.canW('schedule') ? '' : stageOpts[0]?.id ?? ''),
    capacity: l?.capacity == null ? '' : String(l.capacity), notes: l?.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  return (
    <FormDialog
      title={l ? `Edit ${l.name}` : 'Add location'}
      onClose={onClose}
      onDelete={l ? () => store.delete('locations', l.id) : undefined}
      onSave={async () => {
        if (!v.name.trim()) return 'Enter a name.'
        await store.set('locations', l?.id ?? rid(), {
          name: v.name.trim(), kind: v.kind, stage: v.stage || null, capacity: v.capacity === '' ? null : Number(v.capacity), notes: v.notes,
        })
      }}
    >
      <Field label="Name" full><input value={v.name} placeholder="e.g. Load bay 2, Staging area North" onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Type">
        <select value={v.kind} onChange={e => set('kind', e.target.value as LocationKind)}>
          {Object.entries(LOCATION_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </Field>
      <Field label="Belongs to">
        <select value={v.stage} onChange={e => set('stage', e.target.value)}>
          {a.canW('schedule') && <option value="">Whole festival</option>}
          {stageOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Trucks at once (empty: 1 for load bays and docks, unlimited otherwise)" full>
        <input type="number" min={1} value={v.capacity} onChange={e => set('capacity', e.target.value)} />
      </Field>
      <Field label="Notes for drivers" full><textarea value={v.notes} placeholder="e.g. Enter via gate 7, wait for a call on Ch 1" onChange={e => set('notes', e.target.value)} /></Field>
      <p className="fld full small muted">A location can belong to one {t.stage.toLowerCase()} (its load bay) or the whole festival (staging areas, truck parks).</p>
    </FormDialog>
  )
}
