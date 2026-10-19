/*
 * The one interface every screen talks to. The local implementation keeps
 * everything in memory and saves it to localStorage; a Supabase
 * implementation can replace it later without touching the UI.
 *
 * Reads are synchronous against the latest snapshot. Writes are async and
 * reject with a StoreError when refused, so the UI can tell the user.
 */
import type { CollectionName, Collections, EventConfig, Id, Roles, Snapshot } from '../types/model'

export type DeepPartial<T> = T extends unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

/**
 * Omit that keeps union members apart. Plain Omit on a union (such as Clock,
 * one type per kind) keeps only the keys every member shares.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** A document as written: the id is the key, so it is optional in the body. */
export type DocInput<K extends CollectionName> = DistributiveOmit<Collections[K], 'id'> & { id?: Id }

export type StoreErrorCode = 'not_found' | 'permission_denied' | 'quota_exceeded' | 'unavailable'

export class StoreError extends Error {
  readonly code: StoreErrorCode
  constructor(code: StoreErrorCode, message: string) {
    super(message)
    this.name = 'StoreError'
    this.code = code
  }
}

export type Listener = (snap: Snapshot) => void

export interface DataStore {
  /** The latest snapshot. Replaced (never mutated) on every change, so it is safe for React. */
  snapshot(): Snapshot
  get<K extends CollectionName>(col: K, id: Id): Collections[K] | undefined
  /** Called after every change. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void

  /** Create or replace a document. */
  set<K extends CollectionName>(col: K, id: Id, doc: DocInput<K>): Promise<void>
  /** Deep-merge into an existing document. Arrays are replaced, not merged. */
  update<K extends CollectionName>(col: K, id: Id, patch: DeepPartial<Omit<Collections[K], 'id'>>): Promise<void>
  delete(col: CollectionName, id: Id): Promise<void>
  /** Create or replace several documents in one change. */
  setMany<K extends CollectionName>(col: K, docs: Collections[K][]): Promise<void>

  setEvent(cfg: EventConfig): Promise<void>
  setRoles(roles: Roles): Promise<void>
}
