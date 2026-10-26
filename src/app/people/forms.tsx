import { useState } from 'react'
import { useConfig, useStore } from '../../data/hooks'
import { tr } from '../../i18n'
import { rid } from '../../lib/id'
import { parseCrewList } from '../../lib/importPeople'
import { accredLevels } from '../../lib/accred'
import type { Accred, Id, Person } from '../../types/model'
import { useAccess } from '../session'
import { Field, FormDialog } from '../ui/Dialog'
import { useToast } from '../ui/toast'

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

/** Paste a crew list from a spreadsheet: one person per line. */
export function ImportForm({ sid, onClose }: { sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const cfg = useConfig('event')
  const toast = useToast()
  const stageOpts = a.stagesSorted().filter(s => a.canW('personnel', s.id))
  const [text, setText] = useState('')
  const [dept, setDept] = useState('')
  const [stage, setStage] = useState(sid ?? (a.canW('personnel') ? '' : stageOpts[0]?.id ?? ''))
  const preview = parseCrewList(text)
  return (
    <FormDialog
      title={tr('Paste a crew list')}
      saveLabel={preview.length ? (preview.length === 1 ? tr('Add 1 person') : tr('Add {n} people', { n: preview.length })) : tr('Add people')}
      onClose={onClose}
      onSave={async () => {
        const people = parseCrewList(text, { dept: dept || null, stage: stage || null })
        if (!people.length) return tr('Paste at least one line.')
        await store.setMany('people', people)
        toast(people.length === 1 ? tr('Added 1 person.') : tr('Added {n} people.', { n: people.length }))
      }}
    >
      <Field label={tr('One person per line: name, job title, phone, email')} full>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'Kari Nordmann, Stagehand, +47 900 00 000, kari@example.com\nOla Hansen\tRigger\t+47 911 11 111'}
        />
      </Field>
      <Field label={tr('Department')}>
        <select value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">—</option>
          {cfg?.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label={tr('Works on')}>
        <select value={stage} onChange={e => setStage(e.target.value)}>
          {!sid && a.canW('personnel') && <option value="">{tr('HQ / no stage')}</option>}
          {stageOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      {preview.length > 0 && (
        <p className="fld full small muted">{tr('First line reads as:')} <b>{preview[0].name}</b>{preview[0].title && ` · ${preview[0].title}`}{preview[0].phone && ` · ${preview[0].phone}`}{preview[0].email && ` · ${preview[0].email}`}</p>
      )}
    </FormDialog>
  )
}
