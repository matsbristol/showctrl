import { useState } from 'react'
import { useDoc, useStore } from '../../data/hooks'
import { RISK_FACTORS, RISK_LEVELS } from '../../types/constants'
import type { Artist, RiskLevel } from '../../types/model'
import { useAccess } from '../session'
import { useServerTime } from '../time'
import { Field, FormDialog } from '../ui/Dialog'
import { tr } from '../../i18n'

/** Rate a performer green, orange or red, with factors and notes. */
export function RiskForm({ artist, onClose }: { artist: Artist; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const now = useServerTime()
  const cur = useDoc('risks', artist.id)
  const [level, setLevel] = useState<RiskLevel | null>(cur?.level ?? null)
  const [factors, setFactors] = useState<string[]>(cur?.factors ?? [])
  const [notes, setNotes] = useState(cur?.notes ?? '')
  const extra = factors.filter(f => !(RISK_FACTORS as readonly string[]).includes(f))
  const toggle = (f: string, on: boolean) => setFactors(x => (on ? [...x, f] : x.filter(y => y !== f)))

  return (
    <FormDialog
      title={tr('Risk assessment · {name}', { name: artist.name })}
      onClose={onClose}
      onDelete={cur ? () => store.delete('risks', artist.id) : undefined}
      onSave={async () => {
        if (!level) return tr('Choose green, orange or red.')
        await store.set('risks', artist.id, { artist: artist.id, level, factors, notes: notes.trim(), by: a.me, at: now() })
      }}
    >
      <fieldset className="fld full">
        <legend>{tr('Rating')}</legend>
        <div className="risk-pick" role="radiogroup" aria-label={tr('Rating')}>
          {(Object.keys(RISK_LEVELS) as RiskLevel[]).map(l => (
            <button key={l} type="button" role="radio" aria-checked={level === l} className={`risk-${l}`} onClick={() => setLevel(l)}>
              <b>{tr(RISK_LEVELS[l].label)}</b>
              <span>{tr(RISK_LEVELS[l].hint)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fld full">
        <legend>{tr('Risk factors')}</legend>
        <div className="checks">
          {[...RISK_FACTORS, ...extra].map(f => (
            <label key={f}><input type="checkbox" checked={factors.includes(f)} onChange={e => toggle(f, e.target.checked)} />{tr(f)}</label>
          ))}
        </div>
      </fieldset>
      <Field label={tr('Measures and notes')} full>
        <textarea value={notes} placeholder={tr('e.g. Extra pit security, briefing with the tour manager at 19:30')} onChange={e => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  )
}
