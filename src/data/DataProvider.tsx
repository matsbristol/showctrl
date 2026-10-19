import type { ReactNode } from 'react'
import type { DataStore } from './store'
import { StoreContext } from './hooks'

export function DataProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
