import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { byId, duplicateChannels, parseInputList, sortedInputs, sortedOutputs } from '../../lib/lines'
import type { Artist, Id, InputLine, Lines, OutputLine } from '../../types/model'
import { ActPicker } from '../acts/ActPicker'
import { useActs, useSelectedAct } from '../acts/acts'
import { aOrAn } from '../../lib/text'
import { DaySelector } from '../DaySelector'
import { useAccess, useTerms } from '../session'
import { useServerTime } from '../time'
import { Field, FormDialog } from '../ui/Dialog'
import { tr } from '../../i18n'

/** One editable cell. Saves when you leave the field, so typing never fights live updates. */
function Cell({ value, onSave, readOnly, type = 'text', label, width }: {
  value: string | number; onSave: (v: string) => void; readOnly: boolean; type?: 'text' | 'number'; label: string; width?: string
}) {
  const [v, setV] = useState(String(value ?? ''))
  const [was, setWas] = useState(value)
  if (was !== value) { setWas(value); setV(String(value ?? '')) }
  if (readOnly) return <span>{value}</span>
  return (
    <input className="cell" aria-label={label} type={type} value={v} style={width ? { width } : undefined}
      onChange={e => setV(e.target.value)} onBlur={() => { if (v !== String(value ?? '')) onSave(v) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

function PasteForm({ artist, lines, onClose }: { artist: Artist; lines: Lines | undefined; onClose: () => void }) {
  const store = useStore()
  const now = useServerTime()
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(!lines || !Object.keys(lines.inputs).length)
  const start = replace ? 1 : Math.max(0, ...sortedInputs(lines).map(i => i.ch)) + 1
  const preview = parseInputList(text, start)
  return (
    <FormDialog
      title={tr('Paste input list · {name}', { name: artist.name })}
      saveLabel={preview.length ? tr('Add {n} channels', { n: preview.length }) : tr('Add channels')}
      onClose={onClose}
      onSave={async () => {
        if (!preview.length) return tr('Paste at least one line.')
        const inputs = replace ? byId(preview) : { ...lines?.inputs, ...byId(preview) }
        await store.set('lines', artist.id, { artist: artist.id, inputs, outputs: lines?.outputs ?? {}, notes: lines?.notes ?? '', updated: now() })
      }}
    >
      <Field label={tr('One channel per line: channel, source, mic, stand (tabs, semicolons or wide gaps between columns)')} full>
        <textarea value={text} rows={10} placeholder={'1\tKick in\tBeta 91\n2\tKick out\tD6\tshort\n3\tSnare top\tSM57\tclamp\n4\tAc gtr\tDI\t\t48V'} onChange={e => setText(e.target.value)} />
      </Field>
      {lines && Object.keys(lines.inputs).length > 0 && (
        <Field label={tr('Existing channels')} full>
          <div className="checks"><label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />{tr('Replace the current list')}</label></div>
        </Field>
      )}
      {preview.length > 0 && <p className="fld full small muted">{tr('Reads as:')} {preview.slice(0, 3).map(p => `${p.ch} ${p.name}${p.mic ? ` (${p.mic})` : ''}`).join(', ')}{preview.length > 3 ? ' …' : ''}</p>}
    </FormDialog>
  )
}

function LinesEditor({ artist }: { artist: Artist }) {
  const a = useAccess()
  const store = useStore()
  const now = useServerTime()
  const all = useCollection('lines')
  const [pasting, setPasting] = useState(false)
  const lines = all[artist.id]
  const w = a.canW('technical', artist.stage)
  const inputs = sortedInputs(lines)
  const outputs = sortedOutputs(lines)
  const dup = duplicateChannels(lines)

  const ensure = async () => {
    if (!lines) await store.set('lines', artist.id, { artist: artist.id, inputs: {}, outputs: {}, notes: '', updated: now() })
  }
  const setInput = async (id: Id, patch: Partial<InputLine>) => store.update('lines', artist.id, { inputs: { [id]: patch }, updated: now() })
  const setOutput = async (id: Id, patch: Partial<OutputLine>) => store.update('lines', artist.id, { outputs: { [id]: patch }, updated: now() })
  const addInput = async () => {
    await ensure()
    const id = rid()
    await store.update('lines', artist.id, { inputs: { [id]: { id, ch: Math.max(0, ...inputs.map(i => i.ch)) + 1, name: '', mic: '', stand: '' } }, updated: now() })
  }
  const addOutput = async () => {
    await ensure()
    const id = rid()
    await store.update('lines', artist.id, { outputs: { [id]: { id, n: Math.max(0, ...outputs.map(o => o.n)) + 1, name: '', type: 'Wedge' } }, updated: now() })
  }

  return (
    <div className="stack" style={{ gap: '1rem', minWidth: 0 }}>
      <div className="row">
        <h2 style={{ marginRight: 'auto' }}><Link to={`/s/${artist.stage}/artists/${artist.id}`} style={{ color: 'inherit' }}>{artist.name}</Link></h2>
        {w && <button type="button" className="btn" onClick={() => setPasting(true)}>{tr('Paste list')}</button>}
        <button type="button" className="btn no-print" onClick={() => window.print()}>{tr('Print')}</button>
      </div>
      <section className="panel tbl-wrap">
        <div className="ph"><h3>{tr('Inputs')}</h3><span className="small muted">{tr('{n} channels', { n: inputs.length })}{dup.size ? ` · ${tr('channel {ch} used twice', { ch: [...dup].join(', ') })}` : ''}</span></div>
        <table className="lines">
          <thead><tr><th>{tr('Ch')}</th><th>{tr('Source')}</th><th>{tr('Mic / DI')}</th><th>{tr('Stand')}</th><th>48V</th><th>{tr('Box')}</th><th>{tr('Notes')}</th>{w && <th className="no-print" />}</tr></thead>
          <tbody>
            {inputs.map(i => (
              <tr key={i.id} className={dup.has(i.ch) ? 'dup' : undefined}>
                <td className="num"><Cell label={tr('Channel')} type="number" width="3.5rem" value={i.ch} readOnly={!w} onSave={v => void setInput(i.id, { ch: Number(v) || i.ch })} /></td>
                <td><Cell label={tr('Source')} value={i.name} readOnly={!w} onSave={v => void setInput(i.id, { name: v })} /></td>
                <td><Cell label={tr('Mic')} value={i.mic ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { mic: v })} /></td>
                <td><Cell label={tr('Stand')} value={i.stand ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { stand: v })} /></td>
                <td>{w ? <input type="checkbox" aria-label={tr('Phantom power ch {ch}', { ch: i.ch })} checked={!!i.phantom} onChange={e => void setInput(i.id, { phantom: e.target.checked })} /> : i.phantom ? '48V' : ''}</td>
                <td><Cell label={tr('Box')} width="4.5rem" value={i.box ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { box: v })} /></td>
                <td><Cell label={tr('Notes')} value={i.notes ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { notes: v })} /></td>
                {w && <td className="no-print"><button type="button" className="btn sm danger" aria-label={tr('Remove channel {ch}', { ch: i.ch })} onClick={() => void store.update('lines', artist.id, { inputs: { [i.id]: undefined } })}>×</button></td>}
              </tr>
            ))}
            {!inputs.length && <tr><td colSpan={8} className="empty">{tr('No input list yet.')}{w && ` ${tr('Paste one from the band’s rider, or add channels one by one.')}`}</td></tr>}
          </tbody>
        </table>
        {w && <div className="pb no-print"><button type="button" className="btn sm" onClick={() => void addInput()}>{tr('+ Channel')}</button></div>}
      </section>
      <section className="panel tbl-wrap">
        <div className="ph"><h3>{tr('Monitor mixes')}</h3><span className="small muted">{tr('{n} outputs', { n: outputs.length })}</span></div>
        <table className="lines">
          <thead><tr><th>#</th><th>{tr('For')}</th><th>{tr('Type')}</th><th>{tr('Notes')}</th>{w && <th className="no-print" />}</tr></thead>
          <tbody>
            {outputs.map(o => (
              <tr key={o.id}>
                <td className="num"><Cell label={tr('Output')} type="number" width="3.5rem" value={o.n} readOnly={!w} onSave={v => void setOutput(o.id, { n: Number(v) || o.n })} /></td>
                <td><Cell label={tr('For')} value={o.name} readOnly={!w} onSave={v => void setOutput(o.id, { name: v })} /></td>
                <td><Cell label={tr('Type')} value={o.type ?? ''} readOnly={!w} onSave={v => void setOutput(o.id, { type: v })} /></td>
                <td><Cell label={tr('Mix notes')} value={o.notes ?? ''} readOnly={!w} onSave={v => void setOutput(o.id, { notes: v })} /></td>
                {w && <td className="no-print"><button type="button" className="btn sm danger" aria-label={tr('Remove output {n}', { n: o.n })} onClick={() => void store.update('lines', artist.id, { outputs: { [o.id]: undefined } })}>×</button></td>}
              </tr>
            ))}
            {!outputs.length && <tr><td colSpan={5} className="empty">{tr('No monitor mixes yet.')}</td></tr>}
          </tbody>
        </table>
        {w && <div className="pb no-print"><button type="button" className="btn sm" onClick={() => void addOutput()}>{tr('+ Mix')}</button></div>}
      </section>
      {pasting && <PasteForm artist={artist} lines={lines} onClose={() => setPasting(false)} />}
    </div>
  )
}

export function LinesPage({ sid }: { sid: Id | null }) {
  const t = useTerms()
  const lines = useCollection('lines')
  const acts = useActs(sid)
  const [sel, select] = useSelectedAct(acts)
  return (
    <>
      <div className="head no-print">
        <div><h1>{tr('Input lists')}</h1><p>{tr('Channels and monitor mixes per {performer}. Paste straight from the band’s technical rider; changes reach FOH and monitors instantly.', { performer: t.performer.toLowerCase() })}</p></div>
        <div className="actions"><DaySelector /></div>
      </div>
      <div className="split">
        <div className="no-print">
          <ActPicker acts={acts} selected={sel?.id ?? null} onSelect={select} badge={x => { const n = Object.keys(lines[x.id]?.inputs ?? {}).length; return n ? tr('{n} ch', { n }) : '—' }} />
        </div>
        {sel ? <LinesEditor key={sel.id} artist={sel} /> : <div className="panel"><p className="empty">{tr('Choose {a_performer}.', { a_performer: aOrAn(t.performer.toLowerCase()), performer: t.performer.toLowerCase() })}</p></div>}
      </div>
    </>
  )
}
