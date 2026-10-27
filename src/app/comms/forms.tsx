import { useState } from 'react'
import { useConfig, useStore } from '../../data/hooks'
import { tr } from '../../i18n'
import { rid } from '../../lib/id'
import { COMM_KINDS } from '../../types/constants'
import type { CommChannel, CommKind, Id } from '../../types/model'
import { useAccess } from '../session'
import { Field, FormDialog } from '../ui/Dialog'

export function CommForm({ comm, sid, nextOrder, onClose }: { comm: CommChannel | null; sid: Id | null; nextOrder: number; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const cfg = useConfig('event')
  const c = comm
  const stageOpts = a.stagesSorted().filter(s => a.canW('comms', s.id))
  const [v, setV] = useState({
    name: c?.name ?? '', kind: (c?.kind ?? 'radio') as CommKind, channel: c?.channel ?? '',
    stage: c ? c.stage ?? '' : sid ?? (a.canW('comms') ? '' : stageOpts[0]?.id ?? ''), depts: c?.depts ?? [], notes: c?.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  return (
    <FormDialog
      title={c ? tr('Edit {name}', { name: c.name }) : tr('Add comm channel')}
      onClose={onClose}
      onDelete={c ? () => store.delete('comms', c.id) : undefined}
      onSave={async () => {
        if (!v.name.trim()) return tr('Enter a name.')
        if (!v.channel.trim()) return tr('Enter the channel, e.g. Ch 2 or a frequency.')
        await store.set('comms', c?.id ?? rid(), {
          name: v.name.trim(), kind: v.kind, channel: v.channel.trim(), stage: v.stage || null, depts: v.depts, notes: v.notes, order: c?.order ?? nextOrder,
        })
      }}
    >
      <Field label={tr('Name')}><input value={v.name} placeholder={tr('e.g. Production, Security, Stage')} onChange={e => set('name', e.target.value)} /></Field>
      <Field label={tr('Channel')}><input value={v.channel} placeholder={tr('e.g. Ch 2, 446.006 MHz, Clear-Com B')} onChange={e => set('channel', e.target.value)} /></Field>
      <Field label={tr('Type')}>
        <select value={v.kind} onChange={e => set('kind', e.target.value as CommKind)}>
          {Object.entries(COMM_KINDS).map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}
        </select>
      </Field>
      <Field label={tr('Belongs to')}>
        <select value={v.stage} onChange={e => set('stage', e.target.value)}>
          {a.canW('comms') && <option value="">{tr('Whole festival')}</option>}
          {stageOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label={tr('Used by (none ticked: everyone)')} full>
        <div className="checks">
          {cfg?.depts.map(d => (
            <label key={d.id}>
              <input type="checkbox" checked={v.depts.includes(d.id)} onChange={e => set('depts', e.target.checked ? [...v.depts, d.id] : v.depts.filter(x => x !== d.id))} />{d.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label={tr('Notes')} full><textarea value={v.notes} placeholder={tr('Call signs, who’s on it, when to use it')} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}
