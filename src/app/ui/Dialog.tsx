// A modal form dialog, matching openForm() in the prototype.

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { fromLocal, toLocal } from '../../lib/time'
import { useTz } from '../session'
import { tr } from '../../i18n'

/** Return a string from onSave to show it as an error and keep the dialog open. */
export type SaveResult = void | string | false

export function FormDialog({
  title, onClose, onSave, onDelete, saveLabel = tr('Save'), children,
}: {
  title: string
  onClose: () => void
  onSave: () => Promise<SaveResult> | SaveResult
  onDelete?: () => Promise<unknown> | void
  saveLabel?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal?.()
    return () => d?.close?.()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const out = await onSave()
      if (typeof out === 'string') setErr(out)
      else if (out !== false) onClose()
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('Could not save that change.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} className="dlg" onCancel={e => { e.preventDefault(); onClose() }}>
      <form onSubmit={submit}>
        <div className="dh"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={tr('Close')}>×</button></div>
        <div className="db">
          {children}
          {err && <p className="fld full small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
        </div>
        <div className="df">
          {onDelete && (
            <button type="button" className="btn danger" onClick={async () => {
              if (!confirm(tr('Delete this? It is removed for everyone.'))) return
              await onDelete()
              onClose()
            }}>{tr('Delete')}</button>
          )}
          <div className="r">
            <button type="button" className="btn" onClick={onClose}>{tr('Cancel')}</button>
            <button className="btn primary" type="submit" disabled={busy}>{saveLabel}</button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

export function Field({ label, full, hidden, children }: { label: string; full?: boolean; hidden?: boolean; children: ReactNode }) {
  if (hidden) return null
  return <label className={`fld${full ? ' full' : ''}`}><span>{label}</span>{children}</label>
}

/** A date-time input in the event time zone, holding epoch ms. */
export function DateTimeInput({ value, onChange }: { value: number | null | undefined; onChange: (ms: number | null) => void }) {
  const tz = useTz()
  return <input type="datetime-local" value={toLocal(value, tz)} onChange={e => onChange(fromLocal(e.target.value, tz))} />
}
