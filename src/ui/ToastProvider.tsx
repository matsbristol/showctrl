import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ShowToast, type ToastAction } from './hooks'

interface Toast { id: number; text: string; action?: ToastAction }

/** How long a toast stays up; longer when it offers an action. */
const PLAIN_MS = 4500
const ACTION_MS = 9000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), [])

  const show = useCallback<ShowToast>((text, action) => {
    const id = nextId.current++
    setToasts(ts => [...ts, { id, text, action }])
    const timer = setTimeout(() => { timers.current.delete(timer); dismiss(id) }, action ? ACTION_MS : PLAIN_MS)
    timers.current.add(timer)
  }, [dismiss])

  // Don't fire timers into an unmounted tree.
  useEffect(() => {
    const ts = timers.current
    return () => { for (const t of ts) clearTimeout(t) }
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id}>
            <span>{t.text}</span>
            {t.action && (
              <button type="button" onClick={() => { dismiss(t.id); void t.action!.run() }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
