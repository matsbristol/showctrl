/*
 * One modal form at a time, described by data (see FormDef in hooks.ts).
 * Date and time fields read and write in the event time zone, never the
 * device's, so a manager abroad still enters festival time.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSnapshot } from '../data/hooks'
import { DEFAULT_TZ, fromLocal, toLocal } from '../domain/time'
import { FormContext, type FieldDef, type FormDef, type FormValues } from './hooks'

function Field({ f, values, set, tz }: { f: FieldDef; values: FormValues; set: (k: string, v: FormValues[string]) => void; tz: string }) {
  if (f.show && !f.show(values)) return null
  if (f.type === 'note') return <p className="fld full small muted">{f.text}</p>

  const val = values[f.k]
  const name = `f-${f.k}`
  let input: ReactNode
  switch (f.type) {
    case 'select':
      input = (
        <select id={name} value={String(val ?? '')} onChange={e => set(f.k, e.target.value)}>
          {f.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      )
      break
    case 'checks': {
      const on = (val as string[] | null) ?? []
      input = (
        <div className="checks">
          {f.options.length ? f.options.map(([k, l]) => (
            <label key={k}>
              <input type="checkbox" checked={on.includes(k)} onChange={e => set(f.k, e.target.checked ? [...on, k] : on.filter(x => x !== k))} />
              {l}
            </label>
          )) : <span className="muted small">None defined</span>}
        </div>
      )
      break
    }
    case 'textarea':
      input = <textarea id={name} value={String(val ?? '')} placeholder={f.placeholder} onChange={e => set(f.k, e.target.value)} />
      break
    case 'datetime':
      input = (
        <input id={name} type="datetime-local" value={toLocal(val as number | null, tz)}
          onChange={e => set(f.k, fromLocal(e.target.value, tz))} />
      )
      break
    default:
      input = (
        <input id={name} type={f.type === 'number' ? 'number' : 'text'} step={f.type === 'number' ? 'any' : undefined}
          value={String(val ?? '')} placeholder={f.placeholder} onChange={e => set(f.k, e.target.value)} />
      )
  }
  // Checkbox groups get a plain label; single inputs are labelled by id.
  return f.type === 'checks'
    ? <div className={`fld ${f.full ? 'full' : ''}`} role="group" aria-label={f.label}><span>{f.label}</span>{input}</div>
    : <div className={`fld ${f.full ? 'full' : ''}`}><label htmlFor={name}>{f.label}</label>{input}</div>
}

function FormDialog({ def, onClose }: { def: FormDef; onClose: () => void }) {
  const snap = useSnapshot()
  const tz = snap.cfg?.tz ?? DEFAULT_TZ
  const ref = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState<FormValues>(() => ({ ...def.values }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    // jsdom (tests) has no showModal; an open dialog behaves the same there.
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
    d.querySelector<HTMLElement>('input:not([type=checkbox]),select,textarea')?.focus()
  }, [])

  const set = useCallback((k: string, v: FormValues[string]) => setValues(o => ({ ...o, [k]: v })), [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const out = await def.onSave(values)
      if (typeof out === 'string') setError(out)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that change. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    await def.onDelete?.()
    onClose()
  }

  return (
    // Escape fires "cancel" on a modal dialog; treat it as Cancel.
    <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby="dlg-title">
      <form onSubmit={submit}>
        <div className="dh">
          <h2 id="dlg-title">{def.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="db">
          {def.fields.map(f => <Field key={f.k} f={f} values={values} set={set} tz={tz} />)}
          {error && <p className="fld full small err" role="alert">{error}</p>}
        </div>
        <div className="df">
          {def.onDelete && (
            <button type="button" className="btn danger" onClick={remove}>
              {confirmDelete ? 'Yes, delete for everyone' : 'Delete'}
            </button>
          )}
          <div className="r">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy}>{def.saveLabel ?? 'Save'}</button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

export function FormProvider({ children }: { children: ReactNode }) {
  // A counter in the key gives each opened form fresh state.
  const [open, setOpen] = useState<{ def: FormDef; n: number } | null>(null)
  const counter = useRef(0)
  const openForm = useCallback((def: FormDef) => setOpen({ def, n: ++counter.current }), [])
  return (
    <FormContext.Provider value={openForm}>
      {children}
      {open && <FormDialog key={open.n} def={open.def} onClose={() => setOpen(null)} />}
    </FormContext.Provider>
  )
}
