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
      title={`Paste input list · ${artist.name}`}
      saveLabel={preview.length ? `Add ${preview.length} channels` : 'Add channels'}
      onClose={onClose}
      onSave={async () => {
        if (!preview.length) return 'Paste at least one line.'
        const inputs = replace ? byId(preview) : { ...lines?.inputs, ...byId(preview) }
        await store.set('lines', artist.id, { artist: artist.id, inputs, outputs: lines?.outputs ?? {}, notes: lines?.notes ?? '', updated: now() })
      }}
    >
      <Field label="One channel per line: channel, source, mic, stand (tabs, semicolons or wide gaps between columns)" full>
        <textarea value={text} rows={10} placeholder={'1\tKick in\tBeta 91\n2\tKick out\tD6\tshort\n3\tSnare top\tSM57\tclamp\n4\tAc gtr\tDI\t\t48V'} onChange={e => setText(e.target.value)} />
      </Field>
      {lines && Object.keys(lines.inputs).length > 0 && (
        <Field label="Existing channels" full>
          <div className="checks"><label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />Replace the current list</label></div>
        </Field>
      )}
      {preview.length > 0 && <p className="fld full small muted">Reads as: {preview.slice(0, 3).map(p => `${p.ch} ${p.name}${p.mic ? ` (${p.mic})` : ''}`).join(', ')}{preview.length > 3 ? ' …' : ''}</p>}
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
        {w && <button type="button" className="btn" onClick={() => setPasting(true)}>Paste list</button>}
        <button type="button" className="btn no-print" onClick={() => window.print()}>Print</button>
      </div>
      <section className="panel tbl-wrap">
        <div className="ph"><h3>Inputs</h3><span className="small muted">{inputs.length} channels{dup.size ? ` · channel ${[...dup].join(', ')} used twice` : ''}</span></div>
        <table className="lines">
          <thead><tr><th>Ch</th><th>Source</th><th>Mic / DI</th><th>Stand</th><th>48V</th><th>Box</th><th>Notes</th>{w && <th className="no-print" />}</tr></thead>
          <tbody>
            {inputs.map(i => (
              <tr key={i.id} className={dup.has(i.ch) ? 'dup' : undefined}>
                <td className="num"><Cell label="Channel" type="number" width="3.5rem" value={i.ch} readOnly={!w} onSave={v => void setInput(i.id, { ch: Number(v) || i.ch })} /></td>
                <td><Cell label="Source" value={i.name} readOnly={!w} onSave={v => void setInput(i.id, { name: v })} /></td>
                <td><Cell label="Mic" value={i.mic ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { mic: v })} /></td>
                <td><Cell label="Stand" value={i.stand ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { stand: v })} /></td>
                <td>{w ? <input type="checkbox" aria-label={`Phantom power ch ${i.ch}`} checked={!!i.phantom} onChange={e => void setInput(i.id, { phantom: e.target.checked })} /> : i.phantom ? '48V' : ''}</td>
                <td><Cell label="Box" width="4.5rem" value={i.box ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { box: v })} /></td>
                <td><Cell label="Notes" value={i.notes ?? ''} readOnly={!w} onSave={v => void setInput(i.id, { notes: v })} /></td>
                {w && <td className="no-print"><button type="button" className="btn sm danger" aria-label={`Remove channel ${i.ch}`} onClick={() => void store.update('lines', artist.id, { inputs: { [i.id]: undefined } })}>×</button></td>}
              </tr>
            ))}
            {!inputs.length && <tr><td colSpan={8} className="empty">No input list yet.{w && ' Paste one from the band’s rider, or add channels one by one.'}</td></tr>}
          </tbody>
        </table>
        {w && <div className="pb no-print"><button type="button" className="btn sm" onClick={() => void addInput()}>+ Channel</button></div>}
      </section>
      <section className="panel tbl-wrap">
        <div className="ph"><h3>Monitor mixes</h3><span className="small muted">{outputs.length} outputs</span></div>
        <table className="lines">
          <thead><tr><th>#</th><th>For</th><th>Type</th><th>Notes</th>{w && <th className="no-print" />}</tr></thead>
          <tbody>
            {outputs.map(o => (
              <tr key={o.id}>
                <td className="num"><Cell label="Output" type="number" width="3.5rem" value={o.n} readOnly={!w} onSave={v => void setOutput(o.id, { n: Number(v) || o.n })} /></td>
                <td><Cell label="For" value={o.name} readOnly={!w} onSave={v => void setOutput(o.id, { name: v })} /></td>
                <td><Cell label="Type" value={o.type ?? ''} readOnly={!w} onSave={v => void setOutput(o.id, { type: v })} /></td>
                <td><Cell label="Mix notes" value={o.notes ?? ''} readOnly={!w} onSave={v => void setOutput(o.id, { notes: v })} /></td>
                {w && <td className="no-print"><button type="button" className="btn sm danger" aria-label={`Remove output ${o.n}`} onClick={() => void store.update('lines', artist.id, { outputs: { [o.id]: undefined } })}>×</button></td>}
              </tr>
            ))}
            {!outputs.length && <tr><td colSpan={5} className="empty">No monitor mixes yet.</td></tr>}
          </tbody>
        </table>
        {w && <div className="pb no-print"><button type="button" className="btn sm" onClick={() => void addOutput()}>+ Mix</button></div>}
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
        <div><h1>Input lists</h1><p>Channels and monitor mixes per {t.performer.toLowerCase()}. Paste straight from the band’s technical rider; changes reach FOH and monitors instantly.</p></div>
        <div className="actions"><DaySelector /></div>
      </div>
      <div className="split">
        <div className="no-print">
          <ActPicker acts={acts} selected={sel?.id ?? null} onSelect={select} badge={x => { const n = Object.keys(lines[x.id]?.inputs ?? {}).length; return n ? `${n} ch` : '—' }} />
        </div>
        {sel ? <LinesEditor key={sel.id} artist={sel} /> : <div className="panel"><p className="empty">Choose {aOrAn(t.performer.toLowerCase())}.</p></div>}
      </div>
    </>
  )
}
