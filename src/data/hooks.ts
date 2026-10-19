import { createContext, useContext, useSyncExternalStore } from 'react'
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
  const get = () => store.snapshot()
  // Same getter for server rendering (used by the shell's smoke tests).
  return useSyncExternalStore(cb => store.subscribe(cb), get, get)
}
