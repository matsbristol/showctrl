// Live mode: the event's Durable Object over a WebSocket. Implements the same DataStore
// interface as the demo LocalStore, so the UI doesn't know the difference.
//
// Reads come from a local cache that the server fills (snapshot) and keeps current (changes).
// Writes go to the server, which checks permissions, applies them, and broadcasts the result;
// a write resolves when the server acknowledges it.

import { encodePatch, type ClientMsg, type ServerMsg, type WriteOp } from '../shared/protocol'
import { COLLECTIONS } from '../types/constants'
import type { CollectionName, Collections, ConfigDocs, ConfigName, EventConfig, Id, RolesConfig } from '../types/model'
import {
  StoreError, type AuditEntry, type CollectionSnapshot, type DataStore, type DocChange, type DocInput, type DocPatch, type Unsubscribe,
} from './store'

/** The parts of a WebSocket this store uses, so tests can pass a fake. */
export interface SocketLike {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((e: { data: unknown }) => void) | null
  onclose: (() => void) | null
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline'

export interface CloudflareStoreOptions {
  /** Opens a new socket to the event, e.g. () => new WebSocket(url). */
  connect: () => SocketLike
  /** Called on every snapshot with who the server says we are. */
  onSession?: (s: { me: Id; isOwner: boolean }) => void
  /** Reconnect delays in ms; the last one repeats. */
  backoff?: number[]
}

type AnyDoc = { id: Id }
type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void }

export class CloudflareStore implements DataStore {
  readonly mode = 'live' as const

  private col: Partial<Record<CollectionName, Record<Id, AnyDoc>>> = {}
  private cfg: EventConfig | null | undefined = undefined
  private roles: RolesConfig | null | undefined = undefined
  private readonly listeners = new Map<CollectionName, Set<(s: CollectionSnapshot<AnyDoc>) => void>>()
  private readonly cfgListeners = new Map<ConfigName, Set<(doc: unknown) => void>>()
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>()
  private readonly sessionListeners = new Set<() => void>()
  /** Who the server says we are; null until the first snapshot. */
  session: { me: Id; isOwner: boolean } | null = null
  private readonly pending = new Map<number, Pending>()
  private readonly outbox: string[] = []
  private readonly opts: CloudflareStoreOptions
  private socket: SocketLike | null = null
  private seq = 0
  private attempt = 0
  private closed = false
  private timer: ReturnType<typeof setTimeout> | null = null
  status: ConnectionStatus = 'connecting'

  constructor(opts: CloudflareStoreOptions) {
    this.opts = opts
    this.open()
  }

  /** The server identifies the user; nothing to do here. */
  setActor() {}

  /** Stop reconnecting and close the socket. */
  dispose() {
    this.closed = true
    if (this.timer) clearTimeout(this.timer)
    this.socket?.close()
  }

  onSession(l: () => void): Unsubscribe {
    this.sessionListeners.add(l)
    return () => { this.sessionListeners.delete(l) }
  }

  onStatus(l: (s: ConnectionStatus) => void): Unsubscribe {
    this.statusListeners.add(l)
    l(this.status)
    return () => { this.statusListeners.delete(l) }
  }

  /* ---------------- connection ---------------- */

  private setStatus(s: ConnectionStatus) {
    this.status = s
    this.statusListeners.forEach(l => l(s))
  }

  private open() {
    this.setStatus(this.attempt ? 'offline' : 'connecting')
    const ws = this.opts.connect()
    this.socket = ws
    ws.onopen = () => {
      this.attempt = 0
      this.setStatus('online')
      for (const m of this.outbox.splice(0)) ws.send(m)
    }
    ws.onmessage = e => this.receive(String(e.data))
    ws.onclose = () => {
      if (this.socket !== ws) return
      this.socket = null
      // Writes in flight may or may not have landed; tell the caller to check and retry.
      for (const [, p] of this.pending) p.reject(new StoreError('network', 'Connection lost. Check the change and try again.'))
      this.pending.clear()
      if (this.closed) return
      this.setStatus('offline')
      const delays = this.opts.backoff ?? [1000, 2000, 5000, 10_000, 15_000]
      this.timer = setTimeout(() => this.open(), delays[Math.min(this.attempt++, delays.length - 1)])
    }
  }

  private request(m: Omit<ClientMsg, 'req'> & { t: ClientMsg['t'] }): Promise<unknown> {
    const req = ++this.seq
    const raw = JSON.stringify({ ...m, req })
    return new Promise((resolve, reject) => {
      this.pending.set(req, { resolve, reject })
      if (this.socket && this.status === 'online') this.socket.send(raw)
      else this.outbox.push(raw)
    })
  }

  private receive(raw: string) {
    let m: ServerMsg
    try { m = JSON.parse(raw) as ServerMsg } catch { return }
    switch (m.t) {
      case 'snapshot': {
        if (this.session?.me !== m.me || this.session?.isOwner !== m.isOwner) {
          this.session = { me: m.me, isOwner: m.isOwner }
          this.sessionListeners.forEach(l => l())
        }
        this.opts.onSession?.(this.session)
        this.cfg = m.cfg
        this.roles = m.roles
        for (const c of COLLECTIONS) {
          const before = this.col[c] ?? {}
          const after = (m.col[c] ?? {}) as Record<Id, AnyDoc>
          this.col[c] = after
          this.emit(c, diff(before, after), true)
        }
        this.emitConfig('event')
        this.emitConfig('roles')
        return
      }
      case 'changes': {
        const cur = { ...(this.col[m.col] ?? {}) }
        for (const ch of m.changes as DocChange<AnyDoc>[]) {
          if (ch.type === 'removed') delete cur[ch.id]
          else cur[ch.id] = ch.doc
        }
        this.col[m.col] = cur
        this.emit(m.col, m.changes as DocChange<AnyDoc>[])
        return
      }
      case 'config':
        if (m.which === 'event') this.cfg = m.doc as EventConfig | null
        else this.roles = m.doc as RolesConfig | null
        this.emitConfig(m.which)
        return
      case 'ack': return this.settle(m.req, undefined)
      case 'pong': return this.settle(m.req, m.now)
      case 'audit': return this.settle(m.req, m.entries)
      case 'error': {
        const code = m.code === 'invalid' ? 'unknown' : m.code
        const p = this.pending.get(m.req)
        this.pending.delete(m.req)
        p?.reject(new StoreError(code, m.message))
      }
    }
  }

  private settle(req: number, v: unknown) {
    const p = this.pending.get(req)
    this.pending.delete(req)
    p?.resolve(v)
  }

  private emit(col: CollectionName, changes: DocChange<AnyDoc>[], always = false) {
    if (!changes.length && !always) return
    const docs = this.col[col] ?? {}
    for (const l of this.listeners.get(col) ?? []) l({ docs, changes })
  }

  private emitConfig(which: ConfigName) {
    const doc = this.peekConfig(which)
    for (const l of this.cfgListeners.get(which) ?? []) l(doc)
  }

  /* ---------------- DataStore ---------------- */

  peek<K extends CollectionName>(col: K) {
    return this.col[col] as Readonly<Record<Id, Collections[K]>> | undefined
  }

  async get<K extends CollectionName>(col: K, id: Id) {
    return (this.col[col]?.[id] as Collections[K] | undefined) ?? null
  }

  subscribe<K extends CollectionName>(col: K, cb: (snap: CollectionSnapshot<Collections[K]>) => void): Unsubscribe {
    const set = this.listeners.get(col) ?? new Set()
    this.listeners.set(col, set)
    const l = cb as unknown as (s: CollectionSnapshot<AnyDoc>) => void
    set.add(l)
    const docs = this.col[col]
    if (docs) l({ docs, changes: Object.values(docs).map(doc => ({ type: 'added', id: doc.id, doc })) })
    return () => { set.delete(l) }
  }

  private async op(op: WriteOp) {
    await this.request({ t: 'op', op } as Omit<ClientMsg, 'req'> & { t: 'op' })
  }

  set<K extends CollectionName>(col: K, id: Id, doc: DocInput<Collections[K]>) {
    return this.op({ kind: 'set', col, id, doc: { ...doc, id } as Record<string, unknown> })
  }

  setMany<K extends CollectionName>(col: K, docs: Collections[K][]) {
    if (!docs.length) return Promise.resolve()
    if (docs.some(d => !d.id)) return Promise.reject(new StoreError('unknown', `setMany(${col}): every doc needs an id`))
    return this.op({ kind: 'setMany', col, docs: docs as unknown as (Record<string, unknown> & { id: Id })[] })
  }

  update<K extends CollectionName>(col: K, id: Id, patch: DocPatch<Collections[K]>) {
    return this.op({ kind: 'update', col, id, patch: encodePatch(patch) as Record<string, unknown> })
  }

  delete(col: CollectionName, id: Id) {
    return this.op({ kind: 'delete', col, id })
  }

  peekConfig<K extends ConfigName>(which: K): ConfigDocs[K] | null | undefined {
    return (which === 'event' ? this.cfg : this.roles) as ConfigDocs[K] | null | undefined
  }

  subscribeConfig<K extends ConfigName>(which: K, cb: (doc: ConfigDocs[K] | null) => void): Unsubscribe {
    const set = this.cfgListeners.get(which) ?? new Set()
    this.cfgListeners.set(which, set)
    const l = cb as (doc: unknown) => void
    set.add(l)
    const cur = this.peekConfig(which)
    if (cur !== undefined) l(cur)
    return () => { set.delete(l) }
  }

  setConfig<K extends ConfigName>(which: K, doc: ConfigDocs[K]) {
    return this.op({ kind: 'setConfig', which, doc })
  }

  async audit(limit = 100) {
    return (await this.request({ t: 'audit', limit } as Omit<ClientMsg, 'req'> & { t: 'audit' })) as AuditEntry[]
  }
}

function diff(before: Record<Id, AnyDoc>, after: Record<Id, AnyDoc>): DocChange<AnyDoc>[] {
  const out: DocChange<AnyDoc>[] = []
  for (const [id, doc] of Object.entries(after)) if (JSON.stringify(before[id]) !== JSON.stringify(doc)) out.push({ type: id in before ? 'modified' : 'added', id, doc })
  for (const id of Object.keys(before)) if (!(id in after)) out.push({ type: 'removed', id })
  return out
}
