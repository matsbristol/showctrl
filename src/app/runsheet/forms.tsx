import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { buildDaySheet } from '../../lib/daySheet'
import { rid } from '../../lib/id'
import { festDay, fromLocal } from '../../lib/time'
import { HOUR, KINDS, MIN, TRACKS, TRUCK_KINDS } from '../../types/constants'
import { moduleOn } from '../../shared/modules'
import type { Artist, DayKey, Id, RosItem, RosKind } from '../../types/model'
import { useAccess, useTerms, useTz } from '../session'
import { DateTimeInput, Field, FormDialog } from '../ui/Dialog'
import { useToast } from '../ui/toast'
import { useRunSheetActions } from './actions'

/** Add or edit one run sheet item. */
export function ItemForm({ item, sid, day, onClose }: { item: Partial<RosItem>; sid: Id | null; day: DayKey; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const artists = useCollection('artists')
  const stages = a.stagesSorted().filter(s => a.canW('schedule', s.id))
  const start0 = item.start ?? fromLocal(`${day}T18:00`, tz)!
  const [v, setV] = useState({
    kind: (item.kind ?? 'show') as RosKind,
    artist: item.artist ?? '',
    title: item.title ?? '',
    start: start0 as number | null,
    end: (item.end ?? start0 + HOUR) as number | null,
    stage: item.stage ?? sid ?? stages[0]?.id ?? '',
    notes: item.notes ?? '',
    trucks: item.trucks ? String(item.trucks) : '',
    dest: item.dest ?? '',
  })
  const cfg = useConfig('event')
  const locations = useCollection('locations')
  const showTrucks = moduleOn(cfg, 'trucks') && (TRUCK_KINDS as readonly string[]).includes(v.kind)
  const destOpts = Object.values(locations).filter(l => !l.stage || l.stage === v.stage).sort((x, y) => x.name.localeCompare(y.name))
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  const stageArtists = Object.values(artists).filter(x => x.stage === v.stage).sort((x, y) => x.name.localeCompare(y.name))

  return (
    <FormDialog
      title={item.id ? 'Edit run sheet item' : 'Add to run sheet'}
      onClose={onClose}
      onDelete={item.id ? () => store.delete('ros', item.id!) : undefined}
      onSave={async () => {
        if (!v.start || !v.end) return 'Set a start and an end.'
        if (v.end < v.start) return 'The end must be after the start.'
        if (!v.stage) return `Choose a ${t.stage.toLowerCase()}.`
        const title = v.title.trim() || (v.artist ? artists[v.artist]?.name : '') || KINDS[v.kind].label
        await store.set('ros', item.id ?? rid(), {
          title, kind: v.kind, stage: v.stage, start: v.start, end: v.end, artist: v.artist || null, notes: v.notes,
          ...(showTrucks ? { trucks: Number(v.trucks) || null, dest: v.dest || null } : { trucks: item.trucks ?? null, dest: item.dest ?? null }),
          status: item.status ?? 'pending', delay: item.delay ?? 0, delayNote: item.delayNote ?? '',
          ...(item.actual ? { actual: item.actual } : {}), ...(item.actualEnd ? { actualEnd: item.actualEnd } : {}),
        })
      }}
    >
      <Field label="Activity">
        <select value={v.kind} onChange={e => set('kind', e.target.value as RosKind)}>
          {Object.entries(KINDS).map(([k, x]) => <option key={k} value={k}>{x.label} ({TRACKS[x.track].toLowerCase()})</option>)}
        </select>
      </Field>
      <Field label={t.performer}>
        <select value={v.artist} onChange={e => set('artist', e.target.value)}>
          <option value="">None</option>
          {stageArtists.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label={`Title (empty uses the ${t.performer.toLowerCase()} name)`} full>
        <input value={v.title} onChange={e => set('title', e.target.value)} />
      </Field>
      <Field label="Planned start"><DateTimeInput value={v.start} onChange={x => set('start', x)} /></Field>
      <Field label="Planned end"><DateTimeInput value={v.end} onChange={x => set('end', x)} /></Field>
      <Field label={t.stage}>
        <select value={v.stage} onChange={e => set('stage', e.target.value)}>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Trucks" hidden={!showTrucks}>
        <input type="number" min={0} value={v.trucks} onChange={e => set('trucks', e.target.value)} />
      </Field>
      <Field label="Send trucks to" hidden={!showTrucks}>
        <select value={v.dest} onChange={e => set('dest', e.target.value)}>
          <option value="">Not set</option>
          {destOpts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Notes" full>
        <textarea value={v.notes} placeholder="e.g. Forklift needed, ramp on the left" onChange={e => set('notes', e.target.value)} />
      </Field>
      {item.delay ? <p className="fld full small muted">This item runs {Math.round(item.delay / MIN)} min {item.delay > 0 ? 'late' : 'early'}. Times above are planned times.</p> : null}
    </FormDialog>
  )
}

/** Delay an item and everything after it. */
export function DelayForm({ item, onClose }: { item: RosItem; onClose: () => void }) {
  const { delay } = useRunSheetActions()
  const [min, setMin] = useState('5')
  const [note, setNote] = useState('')
  const [dock, setDock] = useState(true)
  return (
    <FormDialog
      title={`Delay from ${KINDS[item.kind as RosKind]?.label.toLowerCase() ?? 'item'}: ${item.title}`}
      saveLabel="Apply delay"
      onClose={onClose}
      onSave={async () => {
        const m = Math.round(Number(min))
        if (!m) return 'Enter a number of minutes.'
        await delay(item, m, note, dock)
      }}
    >
      <Field label="Minutes (negative pulls earlier)"><input type="number" value={min} onChange={e => setMin(e.target.value)} /></Field>
      <Field label="Reason"><input value={note} placeholder="e.g. Late arrival, power issue, weather" onChange={e => setNote(e.target.value)} /></Field>
      <Field label="Also move" full>
        <div className="checks"><label><input type="checkbox" checked={dock} onChange={e => setDock(e.target.checked)} />Dock and backstage items (load in, load out, departures)</label></div>
      </Field>
    </FormDialog>
  )
}

/** Generates an artist's day sheet from their stage's template. */
export function DaySheetForm({ artist, day, onClose }: { artist: Artist; day: DayKey; onClose: () => void }) {
  const store = useStore()
  const t = useTerms()
  const tz = useTz()
  const toast = useToast()
  const stages = useCollection('stages')
  const ros = useCollection('ros')
  const st = stages[artist.stage]
  const show = Object.values(ros).filter(i => i.artist === artist.id && i.kind === 'show').sort((x, y) => x.start - y.start)[0]
  const [start, setStart] = useState<number | null>(show?.start ?? fromLocal(`${day}T20:00`, tz))
  const [len, setLen] = useState(String(show ? Math.round((show.end - show.start) / MIN) : 60))
  const [sc, setSc] = useState<number | null>(null)
  const [replace, setReplace] = useState(!!show)
  if (!st) return null
  return (
    <FormDialog
      title={`Day sheet · ${artist.name}`}
      saveLabel="Create day sheet"
      onClose={onClose}
      onSave={async () => {
        if (!start || !Number(len)) return 'Set the on-stage time and show length.'
        const items = buildDaySheet(st, artist, start, start + Number(len) * MIN, sc)
        if (replace) {
          const d = festDay(start, tz)
          await Promise.all(Object.values(store.peek('ros') ?? {}).filter(x => x.artist === artist.id && festDay(x.start, tz) === d).map(x => store.delete('ros', x.id)))
        }
        await store.setMany('ros', items)
        toast(`Day sheet created for ${artist.name}: ${items.length} items.`)
      }}
    >
      <Field label="On stage"><DateTimeInput value={start} onChange={setStart} /></Field>
      <Field label="Show length (minutes)"><input type="number" value={len} onChange={e => setLen(e.target.value)} /></Field>
      <Field label="Soundcheck (optional)"><DateTimeInput value={sc} onChange={setSc} /></Field>
      <Field label="Replace" full>
        <div className="checks"><label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />Replace this {t.performer.toLowerCase()}’s existing items that day</label></div>
      </Field>
      <p className="fld full small muted">Uses {st.name}’s template: arrival, get in, load in, stage access, changeover, show, load out and departure. You can adjust each item afterwards.</p>
    </FormDialog>
  )
}

/** Adds a performer to a stage and builds their day sheet in one go. */
export function AddPerformerForm({ sid, day, onClose }: { sid: Id; day: DayKey; onClose: () => void }) {
  const store = useStore()
  const t = useTerms()
  const tz = useTz()
  const toast = useToast()
  const stages = useCollection('stages')
  const [name, setName] = useState('')
  const [start, setStart] = useState<number | null>(fromLocal(`${day}T20:00`, tz))
  const [len, setLen] = useState('60')
  const [sc, setSc] = useState<number | null>(null)
  const [tm, setTm] = useState({ name: '', phone: '', email: '' })
  return (
    <FormDialog
      title={`Add ${t.performer.toLowerCase()} with day sheet`}
      saveLabel="Add"
      onClose={onClose}
      onSave={async () => {
        if (!name.trim()) return 'Enter a name.'
        if (!start || !Number(len)) return 'Set the on-stage time and show length.'
        const id = rid()
        const contacts = tm.name || tm.phone || tm.email ? [{ id: rid(), role: 'Tour manager', name: tm.name || 'Tour manager', phone: tm.phone, email: tm.email }] : []
        await store.set('artists', id, { name: name.trim(), stage: sid, status: 'confirmed', contacts, notes: '' })
        const items = buildDaySheet(stages[sid], { id, name: name.trim() }, start, start + Number(len) * MIN, sc)
        await store.setMany('ros', items)
        toast(`${name.trim()} added with ${items.length} run sheet items.`)
      }}
    >
      <Field label="Name" full><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="On stage"><DateTimeInput value={start} onChange={setStart} /></Field>
      <Field label="Show length (minutes)"><input type="number" value={len} onChange={e => setLen(e.target.value)} /></Field>
      <Field label="Soundcheck (optional)"><DateTimeInput value={sc} onChange={setSc} /></Field>
      <Field label="Tour manager name"><input value={tm.name} onChange={e => setTm({ ...tm, name: e.target.value })} /></Field>
      <Field label="Tour manager phone"><input value={tm.phone} onChange={e => setTm({ ...tm, phone: e.target.value })} /></Field>
      <Field label="Tour manager email" full><input value={tm.email} onChange={e => setTm({ ...tm, email: e.target.value })} /></Field>
    </FormDialog>
  )
}
