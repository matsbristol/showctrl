// Plain data shapes shared by the demo store, the sample data and the server. No browser APIs.

import { COLLECTIONS } from '../types/constants'
import type { CollectionName, Collections, EventConfig, Id, RolesConfig } from '../types/model'
import type { AuditEntry } from './store'

export type CollectionData = { [K in CollectionName]: Record<Id, Collections[K]> }

/** A whole event: settings, roles and every collection. */
export interface LocalData {
  cfg: EventConfig | null
  roles: RolesConfig | null
  col: CollectionData
  audit?: AuditEntry[]
}

export function emptyCollections(): CollectionData {
  return Object.fromEntries(COLLECTIONS.map(c => [c, {}])) as CollectionData
}
