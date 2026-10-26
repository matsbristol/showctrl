import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLive } from './live'
import { tr } from '../i18n'

function NameForm({ initial, onDone, autoFocus }: { initial: string; onDone?: () => void; autoFocus?: boolean }) {
  const live = useLive()
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!live) return
    setBusy(true)
    setErr('')
    try { await live.setName(name); onDone?.() } catch (x) { setErr(x instanceof Error ? x.message : tr('Could not save your name.')) } finally { setBusy(false) }
  }
  return (
    <form className="yourname-form" onSubmit={e => void save(e)}>
      <input aria-label={tr('Your name')} value={name} maxLength={60} autoFocus={autoFocus} placeholder={tr('First and last name')} onChange={e => setName(e.target.value)} />
      <button type="submit" className="btn sm primary" disabled={busy || !name.trim()}>{busy ? tr('Saving…') : tr('Save')}</button>
      {err && <span className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</span>}
    </form>
  )
}

/** Live mode, until someone has given their name: asks once, so messages show who sent them. */
export function NamePrompt() {
  const live = useLive()
  if (!live || live.name) return null
  return (
    <div className="yourname-prompt no-print" role="region" aria-label={tr('Your name')}>
      <span><b>{tr('What’s your name?')}</b> {tr('People see it on your messages and in lists instead of your email.')}</span>
      <NameForm initial="" />
    </div>
  )
}

/** The name in the top bar. Live: click it to change the name you go by. */
export function YourNameButton({ label, title }: { label: React.ReactNode; title: string }) {
  const live = useLive()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  if (!live) return <span className="who-name" title={title}>{label}</span>
  return (
    <div className="yourname" ref={box}>
      <button type="button" className="who-name" title={`${title} · ${tr('change your name')}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}</button>
      {open && (
        <div className="yourname-pop" role="dialog" aria-label={tr('Change your name')}>
          <span className="small muted">{tr('The name people see on your messages, in every event.')}</span>
          <NameForm initial={live.name ?? ''} autoFocus onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
