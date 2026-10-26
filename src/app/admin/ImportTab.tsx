import { useMemo, useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { tr } from '../../i18n'
import { applyImport, IMPORT_GROUPS, importable, planImport, type ImportGroup } from '../../lib/importPlan'
import type { ImportResult } from '../../shared/importSchema'
import { IMPORT_MAX_CHARS } from '../../types/constants'
import type { Id } from '../../types/model'
import { readImport } from '../backend'
import { useAccess, useTerms } from '../session'
import { useToast } from '../ui/toast'

/**
 * Paste anything (a line-up, a contact sheet, an email) and Claude sorts it into stages,
 * artists, day sheets, people and hotels. Nothing is saved until the admin picks what to keep.
 */
export function ImportTab({ w, read = readImport }: { w: boolean; read?: (text: string) => Promise<ImportResult> }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const toast = useToast()
  const cfg = useConfig('event')!
  const state = {
    cfg, stages: useCollection('stages'), artists: useCollection('artists'), ros: useCollection('ros'),
    people: useCollection('people'), hotels: useCollection('hotels'), bookings: useCollection('bookings'),
  }
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [defaultStage, setDefaultStage] = useState<Id | null>(null)
  const [unticked, setUnticked] = useState<Set<string>>(new Set())

  // Planned once per reading (and per default stage), so ids stay put while the admin ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => (result ? planImport(result, state, defaultStage) : null), [result, defaultStage])
  const ticked = useMemo(() => new Set(plan?.rows.map(r => r.key).filter(k => !unticked.has(k))), [plan, unticked])
  const ready = plan ? importable(plan, ticked) : []
  const readyKeys = new Set(ready.map(r => r.key))
  const toggle = (keys: string[], on: boolean) => setUnticked(u => { const n = new Set(u); keys.forEach(k => (on ? n.delete(k) : n.add(k))); return n })

  if (store.mode === 'local') {
    return <section className="panel" style={{ maxWidth: 640 }}><p className="pb muted">{tr('Import reads text with Claude, so it works on showctrl.no and not in demo mode.')}</p></section>
  }
  if (!w) return <section className="panel" style={{ maxWidth: 640 }}><p className="pb muted">{tr('Only event admins can import.')}</p></section>

  const groupLabel: Record<ImportGroup, string> = {
    stages: t.stages, artists: t.performers, shows: tr('Shows and day sheets'), items: tr('Run sheet items'),
    people: tr('People'), hotels: tr('Hotels'), bookings: tr('Hotel bookings'),
  }

  const readIt = async () => {
    setBusy(true)
    setErr('')
    try {
      setResult(await read(text))
      setUnticked(new Set())
    } catch (e) {
      setErr(e instanceof Error ? tr(e.message) : tr('Something went wrong. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const doImport = async () => {
    setBusy(true)
    try {
      const n = await applyImport(store, cfg, ready)
      toast(n === 1 ? tr('Imported 1 entry.') : tr('Imported {n} entries.', { n }))
      setResult(null)
      setText('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr('Something went wrong. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (!plan) {
    return (
      <section className="panel" style={{ maxWidth: 820 }}>
        <div className="ph"><h3>{tr('Import from text')}</h3></div>
        <div className="pb stack" style={{ gap: '.75rem' }}>
          <p className="muted small">
            {tr('Paste anything about the event: a line-up, a running order, a contact list, an email from an agent. Claude sorts it into {stages}, {performers}, day sheets, people and hotels. You check everything before it’s saved.', { stages: t.stages.toLowerCase(), performers: t.performers.toLowerCase() })}
          </p>
          <textarea className="import-text" rows={14} value={text} maxLength={IMPORT_MAX_CHARS} aria-label={tr('Text to import')}
            placeholder={tr('e.g. Friday 12 June, Main stage: Kaizers Orchestra 21:00–22:30, TM Ola Nordmann +47 900 00 000')} onChange={e => setText(e.target.value)} />
          {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={() => void readIt()}>{busy ? tr('Reading… (up to a minute)') : tr('Read it')}</button>
            <span className="small muted num" style={{ marginLeft: 'auto' }}>{text.length.toLocaleString('en-GB')} / {IMPORT_MAX_CHARS.toLocaleString('en-GB')}</span>
          </div>
          <p className="small muted">{tr('The text is sent to Anthropic’s Claude to be read. Anthropic doesn’t train on it. Leave out anything you don’t want to send.')}</p>
        </div>
      </section>
    )
  }

  const stages = a.stagesSorted()
  return (
    <div className="stack" style={{ gap: '1rem', maxWidth: 980 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: '.75rem' }}>
        <p className="muted" style={{ margin: 0 }}>{plan.rows.length ? tr('Untick anything you don’t want. Existing entries only get what they were missing.') : tr('Nothing new found in this text.')}</p>
        {plan.unplaced > 0 && stages.length > 1 && (
          <label className="row small">{tr('Not placed goes on')}
            <select className="inline-sel" value={defaultStage ?? stages[0].id} onChange={e => setDefaultStage(e.target.value)}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {IMPORT_GROUPS.map(g => {
        const rows = plan.rows.filter(r => r.group === g)
        if (!rows.length) return null
        const on = rows.filter(r => ticked.has(r.key)).length
        return (
          <section key={g} className="panel">
            <div className="ph">
              <h3>{groupLabel[g]}</h3>
              <span className="badge">{on}/{rows.length}</span>
              <div className="actions"><button type="button" className="btn sm" onClick={() => toggle(rows.map(r => r.key), on < rows.length)}>{on < rows.length ? tr('Tick all') : tr('Untick all')}</button></div>
            </div>
            <ul className="list import-list">
              {rows.map(r => (
                <li key={r.key} className={ticked.has(r.key) && !readyKeys.has(r.key) ? 'blocked' : undefined}>
                  <label className="row" style={{ alignItems: 'flex-start', gap: '.6rem', flex: 1 }}>
                    <input type="checkbox" checked={ticked.has(r.key)} onChange={e => toggle([r.key], e.target.checked)} />
                    <span className="stack">
                      <span><b>{r.label}</b> <span className={`chip ${r.isNew ? 'go' : ''}`}>{r.isNew ? tr('New') : tr('Update')}</span></span>
                      {r.detail && <span className="small muted">{r.detail}</span>}
                      {r.warn && <span className="small" style={{ color: 'var(--standby)' }}>{r.warn}</span>}
                      {ticked.has(r.key) && !readyKeys.has(r.key) && <span className="small" style={{ color: 'var(--stop)' }}>{tr('Needs an unticked entry above')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {plan.leftover && (
        <section className="panel">
          <div className="ph"><h3>{tr('Not placed')}</h3></div>
          <p className="pb small" style={{ whiteSpace: 'pre-wrap' }}>{plan.leftover}</p>
        </section>
      )}

      {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
      <div className="row">
        <button type="button" className="btn primary" disabled={busy || !ready.length} onClick={() => void doImport()}>
          {busy ? tr('Importing…') : ready.length === 1 ? tr('Import 1 entry') : tr('Import {n} entries', { n: ready.length })}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => setResult(null)}>{tr('Back to the text')}</button>
      </div>
    </div>
  )
}
