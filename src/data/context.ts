import { createContext } from 'react'
import type { DataStore } from './store'

export const DataStoreContext = createContext<DataStore | null>(null)
