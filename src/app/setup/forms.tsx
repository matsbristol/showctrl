import { useState } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { peopleFor } from '../../shared/people'
import { DEFAULT_TPL, TAPE, TPL_FIELDS } from '../../types/constants'
import type { DayTemplate, Id, Stage, TapeColor } from '../../types/model'
import { useAccess, useTerms } from '../session'
import { Field, FormDialog } from '../ui/Dialog'

/** Add or edit a stage's details. Only festival admins add or delete stages. */
export function StageForm({ stage, onClose, onDeleted }: { stage: Stage | null; onClose: () => void; onDeleted?: () => void }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const stages = useCollection('stages')
  const s = stage
  const [v, setV] = useState({
    name: s?.name ?? '', tape: (s?.tape ?? 'blue') as TapeColor, order: String(s?.order ?? Object.keys(stages).length),
    location: s?.location ?? '', radio: s?.radio ?? '', capacity: s?.capacity == null ? '' : String(s.capacity),
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  return (
    <FormDialog
      title={s ? `Edit ${s.name}` : `Add ${t.stage.toLowerCase()}`}
      onClose={onClose}
      onDelete={s && a.canW('admin') ? async () => { await store.delete('stages', s.id); onDeleted?.() } : undefined}
      onSave={async () => {
        if (!v.name.trim()) return 'Enter a name.'
        await store.set('stages', s?.id ?? rid(), {
          ...s, name: v.name.trim(), tape: v.tape, order: Number(v.order) || 0, location: v.location, radio: v.radio,
          capacity: v.capacity === '' ? null : Number(v.capacity),
        })
      }}
    >
      <Field label="Name" full><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Colour">
        <select value={v.tape} onChange={e => set('tape', e.target.value as TapeColor)}>
          {Object.keys(TAPE).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Order"><input type="number" value={v.order} onChange={e => set('order', e.target.value)} /></Field>
      <Field label="Location on site"><input value={v.location} placeholder="e.g. North field, gate C" onChange={e => set('location', e.target.value)} /></Field>
      <Field label="Radio channel"><input value={v.radio} onChange={e => set('radio', e.target.value)} /></Field>
      <Field label="Capacity"><input type="number" value={v.capacity} onChange={e => set('capacity', e.target.value)} /></Field>
    </FormDialog>
  )
}

/** Fields entered as minutes before the show; stored as negative offsets. */
const BEFORE: (keyof DayTemplate)[] = ['arrival', 'getin', 'loadin', 'access']

/** The offsets every new day sheet on this stage is built from. */
export function TemplateForm({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const store = useStore()
  const tp = { ...DEFAULT_TPL, ...stage.template }
  const [v, setV] = useState<Record<keyof DayTemplate, string>>(
    Object.fromEntries(TPL_FIELDS.map(([k]) => [k, String(Math.abs(tp[k]))])) as Record<keyof DayTemplate, string>,
  )
  return (
    <FormDialog
      title={`Day sheet template · ${stage.name}`}
      onClose={onClose}
      onSave={async () => {
        const template = Object.fromEntries(TPL_FIELDS.map(([k]) => [k, (BEFORE.includes(k) ? -1 : 1) * Math.abs(Number(v[k]) || 0)])) as DayTemplate
        await store.update('stages', stage.id, { template })
      }}
    >
      {TPL_FIELDS.map(([k, label]) => (
        <Field key={k} label={label}><input type="number" min={0} value={v[k]} onChange={e => setV(o => ({ ...o, [k]: e.target.value }))} /></Field>
      ))}
    </FormDialog>
  )
}

/**
 * Demo only: create an app user on this stage, as manager or crew. With live sign-in,
 * stage managers will add people who already have an account, or approve requests.
 */
export function DemoUserForm({ sid, asManager, onClose }: { sid: Id; asManager: boolean; onClose: () => void }) {
  const store = useStore()
  const stages = useCollection('stages')
  const people = useCollection('people')
  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  return (
    <FormDialog
      title={asManager ? `Appoint stage manager · ${stages[sid]?.name}` : `Add to ${stages[sid]?.name} team`}
      onClose={onClose}
      onSave={async () => {
        const p = person ? people[person] : undefined
        const n = name.trim() || p?.name
        if (!n) return 'Enter a name or pick a personnel entry.'
        const uid = 'demo-' + rid()
        await store.set('members', uid, { name: n, role: 'none', person: person || null, depts: p?.dept ? [p.dept] : [], stages: asManager ? { [sid]: 'manager' } : {} })
        if (!asManager) {
          const crew = { ...store.peek('stageteam')?.[sid]?.crew, [uid]: true as const }
          await store.set('stageteam', sid, { crew })
        }
      }}
    >
      <Field label="Name" full><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Personnel entry" full>
        <select value={person} onChange={e => setPerson(e.target.value)}>
          <option value="">—</option>
          {peopleFor(people, sid).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
    </FormDialog>
  )
}
