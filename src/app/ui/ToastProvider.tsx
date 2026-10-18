import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ToastAction } from './toast'

interface Toast { id: number; text: string; action?: ToastAction }

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const remove = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), [])
  const show = useCallback((text: string, action?: ToastAction) => {
    const id = ++seq
    setToasts(ts => [...ts, { id, text, action }])
    setTimeout(() => remove(id), action ? 9000 : 4500)
  }, [remove])
  const value = useMemo(() => show, [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id}>
            <span>{t.text}</span>
            {t.action && <button type="button" onClick={() => { t.action!.run(); remove(t.id) }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
