import { useState } from 'react'
import { useConfig, useStore } from '../../data/hooks'
import { tr } from '../../i18n'
import { rid } from '../../lib/id'
import { accredLevels } from '../../lib/accred'
import type { Accred, Id, Person } from '../../types/model'
import { useAccess } from '../session'
import { Field, FormDialog } from '../ui/Dialog'

/** Add or edit a personnel record. Only the stages the user can edit are offered; others are kept as they were. */
export function PersonForm({ person, sid, onClose }: { person: Person | null; sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const cfg = useConfig('event')
  const p = person
  const stageOpts = a.stagesSorted().filter(s => a.canW('personnel', s.id) || p?.stages.includes(s.id))
  const [v, setV] = useState({
    name: p?.name ?? '', title: p?.title ?? '', phone: p?.phone ?? '', email: p?.email ?? '', company: p?.company ?? '',
    dept: p?.dept ?? '', accred: (p?.accred ?? (p ? '' : sid ? 'Stage' : '')) as Accred | '', lead: p?.lead ?? false,
    stages: p?.stages ?? (sid ? [sid] : []), notes: p?.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  const toggleStage = (id: Id, on: boolean) => set('stages', on ? [...v.stages, id] : v.stages.filter(s => s !== id))

  return (
    <FormDialog
      title={p ? tr('Edit {name}', { name: p.name }) : tr('Add person')}
      onClose={onClose}
      onDelete={p ? () => store.delete('people', p.id) : undefined}
      onSave={async () => {
        if (!v.name.trim()) return tr('Enter a name.')
        const keep = (p?.stages ?? []).filter(s => !stageOpts.some(o => o.id === s))
        const stages = [...new Set([...keep, ...v.stages])]
        if (!a.canW('personnel') && !stages.some(s => a.canW('personnel', s))) return tr('Choose a stage you manage.')
        await store.set('people', p?.id ?? rid(), {
          name: v.name.trim(), title: v.title, phone: v.phone, email: v.email, company: v.company,
          dept: v.dept || null, ...(v.accred ? { accred: v.accred } : {}), lead: v.lead, stages, notes: v.notes,
        })
      }}
    >
      <Field label={tr('Name')}><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label={tr('Job title')}><input value={v.title} placeholder={tr('e.g. Stage manager, Backline tech')} onChange={e => set('title', e.target.value)} /></Field>
      <Field label={tr('Phone')}><input value={v.phone} onChange={e => set('phone', e.target.value)} /></Field>
      <Field label={tr('Email')}><input value={v.email} onChange={e => set('email', e.target.value)} /></Field>
      <Field label={tr('Company / supplier')}><input value={v.company} onChange={e => set('company', e.target.value)} /></Field>
      <Field label={tr('Department')}>
        <select value={v.dept} onChange={e => set('dept', e.target.value)}>
          <option value="">—</option>
          {cfg?.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label={tr('Accreditation')}>
        <select value={v.accred} onChange={e => set('accred', e.target.value as Accred | '')}>
          <option value="">{tr('None')}</option>
          {[...new Set([...accredLevels(cfg), ...(v.accred ? [v.accred] : [])])].map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </Field>
      <Field label={tr('Key contact')}>
        <div className="checks"><label><input type="checkbox" checked={v.lead} onChange={e => set('lead', e.target.checked)} />{tr('Show as a key contact')}</label></div>
      </Field>
      <Field label={tr('Works on')} full>
        <div className="checks">
          {stageOpts.map(s => (
            <label key={s.id}>
              <input type="checkbox" checked={v.stages.includes(s.id)} disabled={!a.canW('personnel', s.id)} onChange={e => toggleStage(s.id, e.target.checked)} />{s.name}
            </label>
          ))}
          {!stageOpts.length && <span className="muted small">{tr('None')}</span>}
        </div>
      </Field>
      <Field label={tr('Notes')} full><textarea value={v.notes} placeholder={tr('Shifts, radio call sign, dietary needs…')} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}
