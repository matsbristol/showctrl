import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { Snapshot } from '../types/model'
import type { DataStore } from './store'

export const StoreContext = createContext<DataStore | null>(null)

export function useStore(): DataStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <DataProvider>')
  return store
}

/** The latest snapshot; re-renders on every change. */
export function useSnapshot(): Snapshot {
  const store = useStore()
  // Stable per store, so React subscribes once rather than on every render.
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store])
  const get = useCallback(() => store.snapshot(), [store])
  // Same getter for server rendering (used by the shell's smoke tests).
  return useSyncExternalStore(subscribe, get, get)
}
