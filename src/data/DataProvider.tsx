import { useState, type ReactNode } from 'react'
import { DataStoreContext } from './context'
import { createDataStore } from './createDataStore'
import type { DataStore } from './store'

/** Provides one data store to the app. Pass `store` in tests; otherwise one is created. */
export function DataProvider({ store, children }: { store?: DataStore; children: ReactNode }) {
  const [value] = useState(() => store ?? createDataStore())
  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>
}
