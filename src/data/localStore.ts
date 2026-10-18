// Demo mode: all data in memory, saved to localStorage. Every viewer has their own copy.

import { deepMerge } from '../lib/merge'
import { emptyCollections, type LocalData, type CollectionData } from './collections'
import { COLLECTIONS, SCHEMA_VERSION } from '../types/constants'
import type { CollectionName, Collections, ConfigDocs, ConfigName, EventConfig, Id, RolesConfig } from '../types/model'
import {
  type AuditEntry, type CollectionSnapshot, type DataStore, type DocChange, type DocInput, type DocPatch,
  StoreError, type Unsubscribe,
} from './store'

export { deepMerge }
export { emptyCollections, type CollectionData, type LocalData } from './collections'

export interface LocalStoreOptions {
  /** Data to start from when nothing valid is saved. */
  initial: () => LocalData
  /** localStorage key. Pass null to keep data in memory only. */
  storageKey?: string | null
  /** Defaults to window.localStorage when available. */
  storage?: Storage | null
  /** Debounce for saving, in ms. */
  saveDelay?: number
  actor?: Id | null
}

// v4: rider items keyed by id. Bump when the stored shape changes so old demo data is rebuilt.
export const DEMO_STORAGE_KEY = 'showctrl-demo-v4'
const AUDIT_CAP = 1000

type AnyDoc = { id: Id }
type Listener = (snap: CollectionSnapshot<AnyDoc>) => void

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export class LocalStore implements DataStore {
  readonly mode = 'local' as const

  private cfg: EventConfig | null
  private roles: RolesConfig | null
  private col: CollectionData
  private log: AuditEntry[]
  private actor: Id | null
  private readonly listeners = new Map<CollectionName, Set<Listener>>()
  private readonly cfgListeners = new Map<ConfigName, Set<(doc: unknown) => void>>()
  private readonly storage: Storage | null
  private readonly storageKey: string | null
  private readonly saveDelay: number
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: LocalStoreOptions) {
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage
    this.storageKey = opts.storageKey === undefined ? DEMO_STORAGE_KEY : opts.storageKey
    this.saveDelay = opts.saveDelay ?? 400
    this.actor = opts.actor ?? null
    const data = this.load() ?? opts.initial()
    this.cfg = data.cfg
    this.roles = data.roles
    this.col = { ...emptyCollections(), ...data.col }
    this.log = data.audit ?? []
  }

  setActor(actor: Id | null) {
    this.actor = actor
  }

  /** Replaces everything, e.g. to reset the demo. Notifies every subscriber. */
  reset(data: LocalData) {
    const before = this.col
    this.cfg = data.cfg
    this.roles = data.roles
    this.col = { ...emptyCollections(), ...data.col }
    this.log = data.audit ?? []
    for (const c of COLLECTIONS) this.emit(c, diff<AnyDoc>(before[c], this.col[c]))
    this.emitConfig('event')
    this.emitConfig('roles')
    this.scheduleSave()
  }

  /** Writes any pending save now. */
  flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    this.save()
  }

  peek<K extends CollectionName>(col: K) {
    return this.col[col]
  }

  async get<K extends CollectionName>(col: K, id: Id) {
    return this.col[col][id] ?? null
  }

  subscribe<K extends CollectionName>(col: K, cb: (snap: CollectionSnapshot<Collections[K]>) => void): Unsubscribe {
    const set = this.listeners.get(col) ?? new Set()
    this.listeners.set(col, set)
    const l = cb as unknown as Listener
    set.add(l)
    const docs = this.col[col]
    cb({ docs, changes: Object.values(docs).map(doc => ({ type: 'added', id: doc.id, doc })) })
    return () => { set.delete(l) }
  }

  async set<K extends CollectionName>(col: K, id: Id, doc: DocInput<Collections[K]>) {
    const existed = id in this.col[col]
    const next = { ...doc, id } as unknown as Collections[K]
    this.col = { ...this.col, [col]: { ...this.col[col], [id]: next } }
    this.record('set', col, id)
    this.emit(col, [{ type: existed ? 'modified' : 'added', id, doc: next }])
  }

  async setMany<K extends CollectionName>(col: K, docs: Collections[K][]) {
    if (!docs.length) return
    if (docs.some(d => !d.id)) throw new StoreError('unknown', `setMany(${col}): every doc needs an id`)
    const cur: Record<Id, Collections[K]> = { ...this.col[col] }
    const changes: DocChange<AnyDoc>[] = []
    for (const d of docs) {
      changes.push({ type: d.id in cur ? 'modified' : 'added', id: d.id, doc: d })
      cur[d.id] = { ...d }
      this.record('set', col, d.id)
    }
    this.col = { ...this.col, [col]: cur }
    this.emit(col, changes)
  }

  async update<K extends CollectionName>(col: K, id: Id, patch: DocPatch<Collections[K]>) {
    const cur = this.col[col][id]
    if (!cur) throw new StoreError('not_found', `${col}/${id} does not exist`)
    const next = { ...deepMerge(cur, patch), id }
    this.col = { ...this.col, [col]: { ...this.col[col], [id]: next } }
    this.record('update', col, id, patch)
    this.emit(col, [{ type: 'modified', id, doc: next }])
  }

  async delete(col: CollectionName, id: Id) {
    if (!(id in this.col[col])) return
    const rest = { ...this.col[col] }
    delete rest[id]
    this.col = { ...this.col, [col]: rest }
    this.record('delete', col, id)
    this.emit(col, [{ type: 'removed', id }])
  }

  peekConfig<K extends ConfigName>(which: K): ConfigDocs[K] | null {
    return (which === 'event' ? this.cfg : this.roles) as ConfigDocs[K] | null
  }

  subscribeConfig<K extends ConfigName>(which: K, cb: (doc: ConfigDocs[K] | null) => void): Unsubscribe {
    const set = this.cfgListeners.get(which) ?? new Set()
    this.cfgListeners.set(which, set)
    const l = cb as (doc: unknown) => void
    set.add(l)
    cb(this.peekConfig(which))
    return () => { set.delete(l) }
  }

  async setConfig<K extends ConfigName>(which: K, doc: ConfigDocs[K]) {
    if (which === 'event') this.cfg = doc as EventConfig
    else this.roles = doc as RolesConfig
    this.record('setConfig', `config/${which}`, which)
    this.emitConfig(which)
  }

  async audit(limit = 100) {
    return this.log.slice(-limit).reverse()
  }

  /* ---------- internals ---------- */

  private record(op: AuditEntry['op'], col: AuditEntry['col'], id: Id, patch?: unknown) {
    this.log.push({ at: Date.now(), actor: this.actor, op, col, id, ...(patch === undefined ? {} : { patch }) })
    if (this.log.length > AUDIT_CAP) this.log = this.log.slice(-AUDIT_CAP)
  }

  private emit(col: CollectionName, changes: DocChange<AnyDoc>[]) {
    this.scheduleSave()
    if (!changes.length) return
    const docs = this.col[col]
    for (const l of this.listeners.get(col) ?? []) l({ docs, changes })
  }

  private emitConfig(which: ConfigName) {
    this.scheduleSave()
    const doc = this.peekConfig(which)
    for (const l of this.cfgListeners.get(which) ?? []) l(doc)
  }

  private load(): LocalData | null {
    if (!this.storage || !this.storageKey) return null
    try {
      const d = JSON.parse(this.storage.getItem(this.storageKey) ?? 'null') as LocalData | null
      return d?.cfg?.schema === SCHEMA_VERSION && d.col ? d : null
    } catch {
      return null
    }
  }

  private scheduleSave() {
    if (!this.storage || !this.storageKey) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.save() }, this.saveDelay)
  }

  private save() {
    if (!this.storage || !this.storageKey) return
    const data: LocalData = { cfg: this.cfg, roles: this.roles, col: this.col, audit: this.log }
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(data))
    } catch (e) {
      console.warn('showctrl: could not save demo data', e)
    }
  }
}

function diff<T extends AnyDoc>(before: Record<Id, T>, after: Record<Id, T>): DocChange<T>[] {
  const out: DocChange<T>[] = []
  for (const [id, doc] of Object.entries(after)) if (before[id] !== doc) out.push({ type: id in before ? 'modified' : 'added', id, doc })
  for (const id of Object.keys(before)) if (!(id in after)) out.push({ type: 'removed', id })
  return out
}
