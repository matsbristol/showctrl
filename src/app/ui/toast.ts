import { createContext, useContext } from 'react'

export interface ToastAction { label: string; run: () => void }

export const ToastContext = createContext<(text: string, action?: ToastAction) => void>(() => {})

/** Shows a short message at the bottom, optionally with one action button. */
export function useToast() {
  return useContext(ToastContext)
}
