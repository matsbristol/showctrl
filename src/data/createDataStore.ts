import { LocalStore } from './localStore'
import { buildSample } from './sample'
import type { DataStore } from './store'

/**
 * Picks the backend. Only demo mode exists so far; the Cloudflare adapter
 * will be chosen here once it is built.
 */
export function createDataStore(): DataStore {
  return new LocalStore({ initial: () => buildSample() })
}
