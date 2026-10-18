// The one interface every backend implements. Demo mode uses LocalStore; the
// Cloudflare adapter (Worker + Durable Object per event) will implement the same.

import type { CollectionName, Collections, ConfigDocs, ConfigName, DistOmit, Id, Ms } from '../types/model'

export type Unsubscribe = () => void

export type DocChange<T> =
  | { type: 'added' | 'modified'; id: Id; doc: T }
  | { type: 'removed'; id: Id }

/**
 * What a subscriber receives. `docs` is the full collection; `changes` is what
 * changed since the last call (all `added` on the first call). A new `docs`
 * object is created on every change, so it can be compared by reference.
 */
export interface CollectionSnapshot<T> {
  docs: Readonly<Record<Id, T>>
  changes: DocChange<T>[]
}

/**
 * A partial update. Plain objects merge recursively; arrays and other values
 * replace. A key set to `undefined` is removed.
 */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> | undefined }
    : T

/** A record as written. The id comes from the call, so the body may omit it. */
export type DocInput<T extends { id: Id }> = T extends unknown ? Omit<T, 'id'> & { id?: Id } : never

/** An update body: any subset of the record's fields, per union member. */
export type DocPatch<T extends { id: Id }> = DeepPartial<DistOmit<T, 'id'>>

/** One entry in the write log, kept for "who changed this timing" history. */
export interface AuditEntry {
  at: Ms
  actor: Id | null
  op: 'set' | 'update' | 'delete' | 'setConfig'
  col: CollectionName | `config/${ConfigName}`
  id: Id
  /** The update body, for `update` only. */
  patch?: unknown
}

export type StoreErrorCode = 'denied' | 'not_found' | 'quota' | 'rate_limited' | 'network' | 'unknown'

export class StoreError extends Error {
  readonly code: StoreErrorCode
  constructor(code: StoreErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'StoreError'
    this.code = code
  }
}

export interface DataStore {
  /** `local` is demo mode; `live` is a shared backend. */
  readonly mode: 'local' | 'live'

  /** The user id written to the audit log. */
  setActor(actor: Id | null): void

  /** The cached collection, or undefined if it hasn't loaded yet. Same reference until it changes. */
  peek<K extends CollectionName>(col: K): Readonly<Record<Id, Collections[K]>> | undefined
  get<K extends CollectionName>(col: K, id: Id): Promise<Collections[K] | null>
  /** Calls `cb` once with the current docs (if loaded), then on every change. */
  subscribe<K extends CollectionName>(col: K, cb: (snap: CollectionSnapshot<Collections[K]>) => void): Unsubscribe
  /** Creates or replaces a record. */
  set<K extends CollectionName>(col: K, id: Id, doc: DocInput<Collections[K]>): Promise<void>
  /** Creates or replaces many records in one call. Each needs an id. */
  setMany<K extends CollectionName>(col: K, docs: Collections[K][]): Promise<void>
  /** Merges into an existing record. Throws `not_found` if it doesn't exist. */
  update<K extends CollectionName>(col: K, id: Id, patch: DocPatch<Collections[K]>): Promise<void>
  delete(col: CollectionName, id: Id): Promise<void>

  /** The cached config doc: null if it doesn't exist, undefined if not loaded yet. */
  peekConfig<K extends ConfigName>(which: K): ConfigDocs[K] | null | undefined
  subscribeConfig<K extends ConfigName>(which: K, cb: (doc: ConfigDocs[K] | null) => void): Unsubscribe
  setConfig<K extends ConfigName>(which: K, doc: ConfigDocs[K]): Promise<void>

  /** Most recent first. */
  audit(limit?: number): Promise<AuditEntry[]>
}
