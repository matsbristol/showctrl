import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { personName } from '../../shared/people'
import { EVENT_TYPES, TAPE, TZS } from '../../types/constants'
import type { Dept, EventConfig, EventType, Id, Member, TapeColor } from '../../types/model'
import { useAccess } from '../session'
import { Field, FormDialog } from '../ui/Dialog'

/** Event name, type (which sets the vocabulary), time zone, dates and size. */
export function EventForm({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const c = useConfig('event')!
  const [v, setV] = useState({ name: c.name, type: c.type, tz: c.tz, start: c.start, end: c.end, visitors: c.visitors == null ? '' : String(c.visitors) })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  return (
    <FormDialog
      title="Edit event"
      onClose={onClose}
      onSave={async () => {
        if (!v.start || !v.end) return 'Set the first and last day.'
        if (v.end < v.start) return 'The last day must be after the first day.'
        const next: EventConfig = {
          ...c, name: v.name.trim() || 'Untitled event', type: v.type, tz: v.tz, start: v.start, end: v.end,
          visitors: v.visitors === '' ? null : Number(v.visitors), terms: EVENT_TYPES[v.type].terms,
        }
        await store.setConfig('event', next)
      }}
    >
      <Field label="Event name" full><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Event type">
        <select value={v.type} onChange={e => set('type', e.target.value as EventType)}>
          {Object.entries(EVENT_TYPES).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
        </select>
      </Field>
      <Field label="Time zone">
        <select value={v.tz} onChange={e => set('tz', e.target.value)}>
          {(TZS as readonly string[]).includes(v.tz) ? null : <option value={v.tz}>{v.tz}</option>}
          {TZS.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      </Field>
      <Field label="First day"><input type="date" value={v.start} onChange={e => set('start', e.target.value)} /></Field>
      <Field label="Last day"><input type="date" value={v.end} onChange={e => set('end', e.target.value)} /></Field>
      <Field label="Expected visitors"><input type="number" min={0} value={v.visitors} onChange={e => set('visitors', e.target.value)} /></Field>
      <p className="fld full small muted">The event type sets the words used everywhere, e.g. a conference shows “Speakers” and “Rooms”.</p>
    </FormDialog>
  )
}

export function DeptForm({ dept, onClose }: { dept: Dept | null; onClose: () => void }) {
  const store = useStore()
  const c = useConfig('event')!
  const [name, setName] = useState(dept?.name ?? '')
  const [tape, setTape] = useState<TapeColor>(dept?.tape ?? 'grey')
  return (
    <FormDialog
      title={dept ? 'Edit department' : 'Add department'}
      onClose={onClose}
      onDelete={dept ? () => store.setConfig('event', { ...c, depts: c.depts.filter(x => x.id !== dept.id) }) : undefined}
      onSave={async () => {
        if (!name.trim()) return 'Enter a name.'
        const o: Dept = { id: dept?.id ?? rid(), name: name.trim(), tape }
        const depts = dept ? c.depts.map(x => (x.id === dept.id ? o : x)) : [...c.depts, o]
        await store.setConfig('event', { ...c, depts })
      }}
    >
      <Field label="Name" full><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Spike tape colour">
        <select value={tape} onChange={e => setTape(e.target.value as TapeColor)}>{Object.keys(TAPE).map(t => <option key={t} value={t}>{t}</option>)}</select>
      </Field>
    </FormDialog>
  )
}

/**
 * Everything one person can do in showctrl: festival role, linked personnel entry,
 * stage manager and stage crew appointments, and departments for department messages.
 * `isNew` creates a demo user (live mode will pick an existing account instead).
 */
export function AccessForm({ uid: uid0, isNew, onClose }: { uid: Id; isNew?: boolean; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const cfg = useConfig('event')
  const members = useCollection('members')
  const people = useCollection('people')
  const stageteam = useCollection('stageteam')
  const requests = useCollection('requests')
  // Live mode: a new person is added by the email they sign in with.
  const askEmail = isNew && store.mode === 'live'
  const [email, setEmail] = useState('')
  const uid = askEmail ? email.trim().toLowerCase() : uid0
  const m: Partial<Member> = members[uid] ?? {}
  const rq = requests[uid]
  const stages = a.stagesSorted()
  const [v, setV] = useState({
    name: m.name ?? '',
    role: m.role ?? 'none',
    person: m.person ?? '',
    mgr: Object.keys(m.stages ?? {}).filter(s => m.stages?.[s] === 'manager'),
    crew: stages.filter(s => stageteam[s.id]?.crew?.[uid]).map(s => s.id).concat(rq?.stage && !m.role ? [rq.stage] : []),
    depts: m.depts ?? [],
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  const toggle = (k: 'mgr' | 'crew' | 'depts', id: Id, on: boolean) => set(k, on ? [...v[k], id] : v[k].filter(x => x !== id))

  const setCrew = async (sid: Id, on: boolean) => {
    const crew = { ...store.peek('stageteam')?.[sid]?.crew }
    if (on) crew[uid] = true
    else delete crew[uid]
    await store.set('stageteam', sid, { crew })
  }

  return (
    <FormDialog
      title={isNew ? 'Give someone access' : `Access · ${personName(uid, members, people)}`}
      onClose={onClose}
      onDelete={!isNew && members[uid] && uid !== a.me ? async () => {
        for (const s of stages) if (stageteam[s.id]?.crew?.[uid]) await setCrew(s.id, false)
        await store.delete('members', uid)
      } : undefined}
      onSave={async () => {
        if (askEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(uid)) return 'Enter the email address they sign in with.'
        const p = v.person ? people[v.person] : undefined
        const name = v.name.trim() || p?.name || m.name
        if (store.mode === 'local' && !name) return 'Enter a name or link a personnel entry.'
        if (!uid) return 'Enter the email address they sign in with.'
        if (uid === a.me && m.role === 'admin' && v.role !== 'admin') return 'You can’t remove your own admin role. Ask another admin.'
        await store.set('members', uid, {
          role: v.role, person: v.person || null, depts: v.depts,
          stages: Object.fromEntries(v.mgr.map(s => [s, 'manager' as const])),
          ...(name ? { name } : {}),
        })
        for (const s of stages) {
          const has = !!stageteam[s.id]?.crew?.[uid]
          const want = v.crew.includes(s.id)
          if (has !== want) await setCrew(s.id, want)
        }
        if (rq) await store.delete('requests', uid)
      }}
    >
      {askEmail && <Field label="Email (the one they sign in with)" full><input type="email" value={email} autoComplete="off" onChange={e => setEmail(e.target.value)} /></Field>}
      <Field label="Name" full><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Festival role">
        <select value={v.role} onChange={e => set('role', e.target.value)}>
          {Object.entries(a.roles).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Personnel entry">
        <select value={v.person} onChange={e => set('person', e.target.value)}>
          <option value="">— Not linked —</option>
          {Object.values(people).sort((x, y) => x.name.localeCompare(y.name)).map(p => <option key={p.id} value={p.id}>{p.name}{p.title ? ` · ${p.title}` : ''}</option>)}
        </select>
      </Field>
      <Checks label="Stage manager for" options={stages.map(s => [s.id, s.name])} value={v.mgr} onToggle={(id, on) => toggle('mgr', id, on)} />
      <Checks label="Stage crew on" options={stages.map(s => [s.id, s.name])} value={v.crew} onToggle={(id, on) => toggle('crew', id, on)} />
      <Checks label="Departments (for department messages)" options={(cfg?.depts ?? []).map(d => [d.id, d.name])} value={v.depts} onToggle={(id, on) => toggle('depts', id, on)} />
    </FormDialog>
  )
}

function Checks({ label, options, value, onToggle }: { label: string; options: [Id, string][]; value: Id[]; onToggle: (id: Id, on: boolean) => void }) {
  return (
    <fieldset className="fld full">
      <legend>{label}</legend>
      <div className="checks">
        {options.map(([id, l]) => (
          <label key={id}><input type="checkbox" checked={value.includes(id)} onChange={e => onToggle(id, e.target.checked)} />{l}</label>
        ))}
        {!options.length && <span className="muted small">None defined</span>}
      </div>
    </fieldset>
  )
}

/** A new festival role, starting from a copy of an existing one. */
export function RoleAddForm({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const [label, setLabel] = useState('')
  const [copy, setCopy] = useState('site')
  return (
    <FormDialog
      title="Add role"
      onClose={onClose}
      onSave={async () => {
        if (!label.trim()) return 'Enter a name.'
        const src = a.roles[copy] ?? a.roles.none
        await store.setConfig('roles', { roles: { ...a.roles, ['r' + rid()]: { label: label.trim(), perms: { ...src.perms }, contacts: !!src.contacts } } })
      }}
    >
      <Field label="Role name" full><input value={label} placeholder="e.g. Medical coordinator" onChange={e => setLabel(e.target.value)} /></Field>
      <Field label="Start from">
        <select value={copy} onChange={e => setCopy(e.target.value)}>
          {Object.entries(a.roles).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
      </Field>
    </FormDialog>
  )
}

/** Appoint an existing user as stage manager, or (demo) create a new one. */
export function ManagerForm({ sid, onClose }: { sid: Id; onClose: () => void }) {
  const store = useStore()
  const members = useCollection('members')
  const people = useCollection('people')
  const stages = useCollection('stages')
  const others = Object.keys(members).filter(u => members[u].stages?.[sid] !== 'manager')
    .sort((x, y) => personName(x, members, people).localeCompare(personName(y, members, people)))
  const [uid, setUid] = useState(others[0] ?? '')
  const [name, setName] = useState('')
  return (
    <FormDialog
      title={`Appoint stage manager · ${stages[sid]?.name}`}
      onClose={onClose}
      onSave={async () => {
        if (uid === '__new') {
          if (!name.trim()) return 'Enter a name.'
          await store.set('members', 'demo-' + rid(), { name: name.trim(), role: 'none', person: null, depts: [], stages: { [sid]: 'manager' } })
        } else if (uid) {
          await store.update('members', uid, { stages: { [sid]: 'manager' } })
        } else return 'Choose someone.'
      }}
    >
      <Field label="Person" full>
        <select value={uid} onChange={e => setUid(e.target.value)}>
          {others.map(u => <option key={u} value={u}>{personName(u, members, people)}</option>)}
          {store.mode === 'local' && <option value="__new">New person…</option>}
        </select>
      </Field>
      <Field label="Name" full hidden={uid !== '__new'}><input value={name} onChange={e => setName(e.target.value)} /></Field>
    </FormDialog>
  )
}
