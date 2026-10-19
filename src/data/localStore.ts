/*
 * DataStore backed by memory and localStorage: demo mode, and the stand-in
 * until the real backend exists. Same stored shape as the prototype
 * ({cfg, roles, col}), under its own key.
 */
import type { CollectionMap, CollectionName, Collections, EventConfig, Id, Roles, Snapshot } from '../types/model'
import { COLLECTIONS, DEFAULT_ROLES } from '../domain/constants'
import { StoreError, type DataStore, type DeepPartial, type DocInput, type Listener } from './store'

export const LOCAL_KEY = 'showctrl-react-v1'

export interface LocalStoreOptions {
  /** Defaults to window.localStorage when available; null keeps data in memory only. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  key?: string
  /** Builds the starting data when nothing is saved. */
  seed?: () => Snapshot
  /** Debounce for saving, in ms. */
  saveDelay?: number
}

export function emptySnapshot(): Snapshot {
  return {
    cfg: null,
    roles: structuredClone(DEFAULT_ROLES),
    col: Object.fromEntries(COLLECTIONS.map(c => [c, {}])) as CollectionMap,
  }
}

/** Fills in anything missing from saved or seeded data. */
function normalize(d: Partial<Snapshot> | null | undefined): Snapshot {
  const base = emptySnapshot()
  if (!d) return base
  for (const c of COLLECTIONS) (base.col as Record<string, unknown>)[c] = d.col?.[c] ?? {}
  return { cfg: d.cfg ?? null, roles: { ...DEFAULT_ROLES, ...d.roles }, col: base.col }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function deepMerge<T>(a: T, b: unknown): T {
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) }
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
    if (v === undefined) continue
    o[k] = isObj(v) && isObj(o[k]) ? deepMerge(o[k], v) : v
  }
  return o as T
}

function defaultStorage(): LocalStoreOptions['storage'] {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export class LocalStore implements DataStore {
  private snap: Snapshot
  private listeners = new Set<Listener>()
  private storage: LocalStoreOptions['storage']
  private key: string
  private saveDelay: number
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: LocalStoreOptions = {}) {
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage
    this.key = opts.key ?? LOCAL_KEY
    this.saveDelay = opts.saveDelay ?? 400
    const saved = this.load()
    this.snap = saved?.cfg ? normalize(saved) : normalize(opts.seed?.())
    if (!saved?.cfg && this.snap.cfg) this.flush()
  }

  snapshot(): Snapshot {
    return this.snap
  }

  get<K extends CollectionName>(col: K, id: Id): Collections[K] | undefined {
    return this.snap.col[col][id]
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set<K extends CollectionName>(col: K, id: Id, doc: DocInput<K>): Promise<void> {
    this.writeCol(col, { ...this.snap.col[col], [id]: { ...doc, id } as Collections[K] })
  }

  async update<K extends CollectionName>(col: K, id: Id, patch: DeepPartial<Omit<Collections[K], 'id'>>): Promise<void> {
    const cur = this.snap.col[col][id]
    if (!cur) throw new StoreError('not_found', `${col}/${id} does not exist`)
    this.writeCol(col, { ...this.snap.col[col], [id]: { ...deepMerge(cur, patch), id } })
  }

  async delete(col: CollectionName, id: Id): Promise<void> {
    if (!(id in this.snap.col[col])) return
    const next = { ...this.snap.col[col] }
    delete next[id]
    this.writeCol(col, next)
  }

  async setMany<K extends CollectionName>(col: K, docs: Collections[K][]): Promise<void> {
    const next: Record<Id, Collections[K]> = { ...this.snap.col[col] }
    for (const d of docs) next[d.id] = { ...d }
    this.writeCol(col, next)
  }

  async setEvent(cfg: EventConfig): Promise<void> {
    this.commit({ ...this.snap, cfg: { ...cfg } })
  }

  async setRoles(roles: Roles): Promise<void> {
    this.commit({ ...this.snap, roles: { ...DEFAULT_ROLES, ...roles } })
  }

  /** Throws away everything, including saved data, and starts again from `data`. */
  reset(data: Snapshot): void {
    this.commit(normalize(structuredClone(data)))
    this.flush()
  }

  /** Writes pending changes to storage now. */
  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.storage) return
    try {
      this.storage.setItem(this.key, JSON.stringify(this.snap))
    } catch (e) {
      console.warn('showctrl: could not save demo data', e)
    }
  }

  private load(): Partial<Snapshot> | null {
    try {
      return JSON.parse(this.storage?.getItem(this.key) ?? 'null')
    } catch {
      return null
    }
  }

  private writeCol<K extends CollectionName>(col: K, docs: Record<Id, Collections[K]>) {
    this.commit({ ...this.snap, col: { ...this.snap.col, [col]: docs } })
  }

  private commit(next: Snapshot) {
    this.snap = next
    if (this.storage) {
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => this.flush(), this.saveDelay)
    }
    for (const l of this.listeners) l(next)
  }
}
