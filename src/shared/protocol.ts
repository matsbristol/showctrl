// The WebSocket protocol between the browser (CloudflareStore) and an event's Durable Object.
// JSON both ways. Shared so both ends agree on every message.

import type { AuditEntry, DocChange } from '../data/store'
import type { CollectionName, ConfigName, EventConfig, Id, RolesConfig } from '../types/model'

/** A write, as sent by the browser. Validated and applied by the server. */
export type WriteOp =
  | { kind: 'set'; col: CollectionName; id: Id; doc: Record<string, unknown> }
  | { kind: 'update'; col: CollectionName; id: Id; patch: Record<string, unknown> }
  | { kind: 'delete'; col: CollectionName; id: Id }
  | { kind: 'setMany'; col: CollectionName; docs: (Record<string, unknown> & { id: Id })[] }
  | { kind: 'setConfig'; which: ConfigName; doc: unknown }

export type ClientMsg =
  | { t: 'op'; req: number; op: WriteOp }
  | { t: 'audit'; req: number; limit?: number }
  | { t: 'ping'; req: number }

export type Snapshot = {
  cfg: EventConfig | null
  roles: RolesConfig | null
  col: Partial<Record<CollectionName, Record<Id, unknown>>>
}

export type ServerMsg =
  /** Everything this user may see. Sent on connect, and again when their access changes. */
  | ({ t: 'snapshot'; me: Id; isOwner: boolean } & Snapshot)
  | { t: 'changes'; col: CollectionName; changes: DocChange<unknown>[] }
  | { t: 'config'; which: ConfigName; doc: unknown }
  | { t: 'ack'; req: number }
  | { t: 'error'; req: number; code: 'denied' | 'not_found' | 'invalid' | 'quota'; message: string }
  | { t: 'audit'; req: number; entries: AuditEntry[] }
  | { t: 'pong'; req: number; now: number }

/**
 * JSON drops `undefined`, but an update uses it to delete a key.
 * On the wire a deleted key is sent as this marker instead.
 */
export const DELETE = { $delete: true } as const

function isPlain(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Replace `undefined` values in an update body with the DELETE marker (recursively). */
export function encodePatch(p: unknown): unknown {
  if (!isPlain(p)) return p
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) out[k] = v === undefined ? DELETE : encodePatch(v)
  return out
}

/** The reverse of encodePatch: DELETE markers become `undefined` again. */
export function decodePatch(p: unknown): unknown {
  if (!isPlain(p)) return p
  if (p.$delete === true && Object.keys(p).length === 1) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) out[k] = decodePatch(v)
  return out
}
