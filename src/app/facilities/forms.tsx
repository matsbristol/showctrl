import { useState } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { aOrAn } from '../../lib/text'
import { FACILITY_KINDS } from '../../types/constants'
import type { Allocation, Facility, FacilityKind, Id } from '../../types/model'
import { useAccess, useTerms } from '../session'
import { DateTimeInput, Field, FormDialog } from '../ui/Dialog'

export function FacilityForm({ facility, sid, onClose }: { facility: Facility | null; sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const f = facility
  const stageOpts = a.stagesSorted().filter(s => a.canW('facilities', s.id))
  const [v, setV] = useState({
    name: f?.name ?? '', kind: (f?.kind ?? 'dressing') as FacilityKind, stage: f ? f.stage ?? '' : sid ?? '',
    capacity: f?.capacity == null ? '' : String(f.capacity), notes: f?.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  return (
    <FormDialog
      title={f ? `Edit ${f.name}` : 'Add facility'}
      onClose={onClose}
      onDelete={f ? () => store.delete('facilities', f.id) : undefined}
      onSave={async () => {
        if (!v.name.trim()) return 'Enter a name.'
        await store.set('facilities', f?.id ?? rid(), { name: v.name.trim(), kind: v.kind, stage: v.stage || null, capacity: v.capacity === '' ? null : Number(v.capacity), notes: v.notes })
      }}
    >
      <Field label="Name" full><input value={v.name} placeholder="e.g. Dressing room 3, Production office" onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Type">
        <select value={v.kind} onChange={e => set('kind', e.target.value as FacilityKind)}>
          {Object.entries(FACILITY_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Belongs to">
        <select value={v.stage} onChange={e => set('stage', e.target.value)}>
          {a.canW('facilities') && <option value="">Whole festival</option>}
          {stageOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Bookings at once (empty: 1)"><input type="number" min={1} value={v.capacity} onChange={e => set('capacity', e.target.value)} /></Field>
      <Field label="Notes" full><textarea value={v.notes} placeholder="Where it is, key holder, what’s in it" onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}

export function AllocationForm({ alloc, draft, onClose }: { alloc: Allocation | null; draft?: Partial<Allocation>; onClose: () => void }) {
  const store = useStore()
  const t = useTerms()
  const facilities = useCollection('facilities')
  const artists = useCollection('artists')
  const x = { ...draft, ...alloc }
  const facs = Object.values(facilities).sort((p, q) => p.name.localeCompare(q.name))
  const [v, setV] = useState({
    facility: x.facility ?? facs[0]?.id ?? '', artist: x.artist ?? '', label: x.label ?? '',
    from: x.from ?? null as number | null, to: x.to ?? null as number | null, notes: x.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(o => ({ ...o, [k]: val }))
  return (
    <FormDialog
      title={alloc ? 'Edit booking' : 'Book facility'}
      onClose={onClose}
      onDelete={alloc ? () => store.delete('allocations', alloc.id) : undefined}
      onSave={async () => {
        if (!v.facility) return 'Add a facility first.'
        if (!v.artist && !v.label.trim()) return `Choose ${aOrAn(t.performer.toLowerCase())} or say who it’s for.`
        if (!v.from || !v.to || v.to <= v.from) return 'The end must be after the start.'
        await store.set('allocations', alloc?.id ?? rid(), { facility: v.facility, artist: v.artist || null, ...(v.artist ? {} : { label: v.label.trim() }), from: v.from, to: v.to, notes: v.notes })
      }}
    >
      <Field label="Facility">
        <select value={v.facility} onChange={e => set('facility', e.target.value)}>
          {facs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>
      <Field label={t.performer}>
        <select value={v.artist} onChange={e => set('artist', e.target.value)}>
          <option value="">Not {aOrAn(t.performer.toLowerCase())}</option>
          {Object.values(artists).sort((p, q) => p.name.localeCompare(q.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Who" hidden={!!v.artist}><input value={v.label} placeholder="e.g. Press, Catering crew" onChange={e => set('label', e.target.value)} /></Field>
      <Field label="From"><DateTimeInput value={v.from} onChange={val => set('from', val)} /></Field>
      <Field label="To"><DateTimeInput value={v.to} onChange={val => set('to', val)} /></Field>
      <Field label="Notes" full><input value={v.notes} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}
