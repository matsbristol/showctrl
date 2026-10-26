import { useState } from 'react'
import { useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { SCREEN_BLOCKS } from '../../types/constants'
import type { Id, Screen, ScreenBlock } from '../../types/model'
import { useAccess, useTerms } from '../session'
import { Field, FormDialog } from '../ui/Dialog'
import { tr } from '../../i18n'

export function ScreenForm({ screen, sid, onClose }: { screen: Screen | null; sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const s = screen
  const [name, setName] = useState(s?.name ?? '')
  const [scope, setScope] = useState(s ? s.scope ?? '' : sid ?? '')
  const [stages, setStages] = useState<Id[]>(s?.stages ?? (sid ? [sid] : []))
  const [blocks, setBlocks] = useState<ScreenBlock[]>(s?.blocks ?? ['clock', 'nownext', 'schedule'])
  const scopes = [...(a.canW('clocks') ? [['', 'Festival HQ']] : []), ...a.stagesSorted().filter(x => a.canW('clocks', x.id)).map(x => [x.id, x.name])]
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter(x => x !== v))
  const order = Object.keys(SCREEN_BLOCKS) as ScreenBlock[]
  return (
    <FormDialog
      title={s ? tr('Edit {name}', { name: s.name }) : tr('Add screen')}
      onClose={onClose}
      onDelete={s ? () => store.delete('screens', s.id) : undefined}
      onSave={async () => {
        if (!name.trim()) return tr('Give the screen a name, e.g. where it hangs.')
        if (!blocks.length) return tr('Choose at least one thing to show.')
        await store.set('screens', s?.id ?? rid(), { name: name.trim(), scope: scope || null, stages, blocks: order.filter(b => blocks.includes(b)), order: s?.order ?? 0 })
      }}
    >
      <Field label={tr('Name')} full><input value={name} placeholder={tr('e.g. Production office, FOH Main Stage, Dock gate')} onChange={e => setName(e.target.value)} /></Field>
      <Field label={tr('Belongs to')}>
        <select value={scope} onChange={e => setScope(e.target.value)}>
          {scopes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <fieldset className="fld full">
        <legend>{tr('{stages} it follows', { stages: t.stages })}</legend>
        <div className="checks">
          {a.stagesSorted().map(x => (
            <label key={x.id}><input type="checkbox" checked={stages.includes(x.id)} onChange={e => setStages(toggle(stages, x.id, e.target.checked))} />{x.name}</label>
          ))}
        </div>
        <small>{tr('None ticked: every {stage}.', { stage: t.stage.toLowerCase() })}</small>
      </fieldset>
      <fieldset className="fld full">
        <legend>{tr('Shows')}</legend>
        <div className="checks">
          {order.map(b => (
            <label key={b}><input type="checkbox" checked={blocks.includes(b)} onChange={e => setBlocks(toggle(blocks, b, e.target.checked))} />{tr(SCREEN_BLOCKS[b])}</label>
          ))}
        </div>
      </fieldset>
    </FormDialog>
  )
}
