import { useState } from 'react'
import { useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { CLOCK_KINDS, HOUR, MIN, TZS } from '../../types/constants'
import type { Clock, ClockKind, DistOmit, Id } from '../../types/model'
import { useAccess, useTz } from '../session'
import { useServerTime } from '../time'
import { DateTimeInput, Field, FormDialog } from '../ui/Dialog'

/** Add or edit a clock. Stage clocks belong to one stage; festival-wide clocks need festival clock rights. */
export function ClockForm({ clock, sid, onClose }: { clock: Clock | null; sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const tz = useTz()
  const now = useServerTime()
  const c = clock
  const [v, setV] = useState({
    label: c?.label ?? '',
    kind: (c?.kind ?? (sid ? 'stage' : 'countdown')) as ClockKind,
    scope: c ? c.scope ?? '' : sid ?? '',
    target: (c?.kind === 'countdown' ? c.target : now() + HOUR) as number | null,
    tz: (c?.kind === 'tod' ? c.tz : undefined) ?? tz,
    stage: (c?.kind === 'stage' ? c.stage : sid) ?? a.stagesSorted()[0]?.id ?? '',
    durationMin: c?.kind === 'timer' && c.duration ? String(c.duration / MIN) : '',
    warn: c?.warn == null ? (c ? '' : '5') : String(c.warn),
    order: String(c?.order ?? 0),
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  const scopes: [string, string][] = [
    ...(a.canW('clocks') ? [['', 'Whole festival'] as [string, string]] : []),
    ...a.stagesSorted().filter(s => a.canW('clocks', s.id)).map(s => [s.id, s.name] as [string, string]),
  ]

  return (
    <FormDialog
      title={c ? 'Edit clock' : 'Add clock'}
      onClose={onClose}
      onDelete={c ? () => store.delete('clocks', c.id) : undefined}
      onSave={async () => {
        const base = { label: v.label.trim(), scope: v.scope || null, warn: v.warn === '' ? null : Number(v.warn), order: Number(v.order) || 0 }
        let doc: DistOmit<Clock, 'id'>
        switch (v.kind) {
          case 'countdown':
            if (!v.target) return 'Choose what it counts down to.'
            doc = { ...base, kind: 'countdown', target: v.target }
            break
          case 'tod': doc = { ...base, kind: 'tod', tz: v.tz }; break
          case 'stage':
            if (!v.stage) return 'Choose a stage to follow.'
            doc = { ...base, kind: 'stage', stage: v.stage }
            break
          case 'timer':
            doc = {
              ...base, kind: 'timer', duration: v.durationMin ? Number(v.durationMin) * MIN : null,
              accum: c?.kind === 'timer' ? c.accum : 0, runningSince: c?.kind === 'timer' ? c.runningSince : null,
            }
            break
        }
        await store.set('clocks', c?.id ?? rid(), doc)
      }}
    >
      <Field label="Name" full><input value={v.label} placeholder="e.g. Curfew, Changeover, Artist home time" onChange={e => set('label', e.target.value)} /></Field>
      <Field label="Type">
        <select value={v.kind} onChange={e => set('kind', e.target.value as ClockKind)}>
          {Object.entries(CLOCK_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Belongs to">
        <select value={v.scope} onChange={e => set('scope', e.target.value)}>
          {scopes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Counts down to" hidden={v.kind !== 'countdown'}><DateTimeInput value={v.target} onChange={x => set('target', x)} /></Field>
      <Field label="Time zone" hidden={v.kind !== 'tod'}>
        <select value={v.tz} onChange={e => set('tz', e.target.value)}>{TZS.map(z => <option key={z} value={z}>{z}</option>)}</select>
      </Field>
      <Field label="Follows" hidden={v.kind !== 'stage'}>
        <select value={v.stage} onChange={e => set('stage', e.target.value)}>{a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </Field>
      <Field label="Length in minutes (empty counts up)" hidden={v.kind !== 'timer'}>
        <input type="number" value={v.durationMin} onChange={e => set('durationMin', e.target.value)} />
      </Field>
      <Field label="Warn when under (minutes)" hidden={v.kind === 'tod'}><input type="number" value={v.warn} onChange={e => set('warn', e.target.value)} /></Field>
      <Field label="Position"><input type="number" value={v.order} onChange={e => set('order', e.target.value)} /></Field>
    </FormDialog>
  )
}
