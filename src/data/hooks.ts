import { useCallback, useContext, useSyncExternalStore } from 'react'
import type { CollectionName, Collections, ConfigDocs, ConfigName, Id } from '../types/model'
import { DataStoreContext } from './context'
import type { DataStore } from './store'

const EMPTY: Readonly<Record<Id, never>> = Object.freeze({})

export function useStore(): DataStore {
  const store = useContext(DataStoreContext)
  if (!store) throw new Error('useStore must be used inside <DataProvider>')
  return store
}

/** All records in a collection, keyed by id. Empty until loaded. Re-renders on any change. */
export function useCollection<K extends CollectionName>(col: K): Readonly<Record<Id, Collections[K]>> {
  const store = useStore()
  const subscribe = useCallback((notify: () => void) => store.subscribe(col, notify), [store, col])
  const get = () => store.peek(col) ?? EMPTY
  return useSyncExternalStore(subscribe, get, get)
}

/** One record, or null if it doesn't exist. Re-renders only when that record changes. */
export function useDoc<K extends CollectionName>(col: K, id: Id | null | undefined): Collections[K] | null {
  const store = useStore()
  const subscribe = useCallback((notify: () => void) => store.subscribe(col, notify), [store, col])
  const get = () => (id ? store.peek(col)?.[id] ?? null : null)
  return useSyncExternalStore(subscribe, get, get)
}

/** A config doc: null if it doesn't exist, undefined while loading. */
export function useConfig<K extends ConfigName>(which: K): ConfigDocs[K] | null | undefined {
  const store = useStore()
  const subscribe = useCallback((notify: () => void) => store.subscribeConfig(which, notify), [store, which])
  const get = () => store.peekConfig(which)
  return useSyncExternalStore(subscribe, get, get)
}
