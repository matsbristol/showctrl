/*
 * The app's one data store. Demo mode for now: the sample festival, saved in
 * this browser. Swap this for the Supabase store when the backend exists;
 * nothing else needs to change.
 */
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'

export const store = new LocalStore({ seed: () => buildSample() })
