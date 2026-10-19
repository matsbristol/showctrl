/* Writes a list of run sheet changes (see domain/runsheet.ts) to the store. */
import type { Change } from '../domain/runsheet'
import type { DataStore } from './store'

/**
 * Applies changes in order. Against a real backend this should become one
 * transaction (and one audit-log entry for "who changed the timings").
 * An artist status update is skipped if that artist has since been
 * deleted, so it can never block a show going live.
 */
export async function applyChanges(store: DataStore, changes: Change[]): Promise<void> {
  for (const c of changes) {
    if (c.col === 'ros') await store.update('ros', c.id, c.patch)
    else if (store.get('artists', c.id)) await store.update('artists', c.id, c.patch)
  }
}
