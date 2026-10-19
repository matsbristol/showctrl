/*
 * The demo-mode data store: the sample festival, saved in this browser.
 * Live mode makes a SupabaseStore per event instead (app/LiveApp.tsx).
 */
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'

let store: LocalStore | null = null

/** Made on first use, so live mode never writes the sample festival to this browser. */
export const demoStore = () => (store ??= new LocalStore({ seed: () => buildSample() }))
