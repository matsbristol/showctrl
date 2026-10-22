// The heart of an event's backend, with no Cloudflare APIs, so it can be unit tested.
// The Durable Object (worker/event.ts) owns one EventCore and persists through CoreStorage.
//
// Responsibilities:
//  - apply writes, enforcing src/shared/writeRules.ts on the server
//  - decide what each user may see (filtering and redaction)
//  - keep fields a writer can't see from being wiped by their write

import { emptyCollections, type CollectionData } from '../data/collections'
import type { AuditEntry, DocChange } from '../data/store'
import { createAccess, mergeRoles, type Access } from '../shared/access'
import { decodePatch, type Snapshot, type WriteOp } from '../shared/protocol'
import { canWrite, canWriteConfig } from '../shared/writeRules'
import { MODULES, moduleOfCollection, moduleOn } from '../shared/modules'
import { deepMerge } from '../lib/merge'
import { COLLECTIONS, DEFAULT_ROLES, SCHEMA_VERSION } from '../types/constants'

export type { CollectionData }
import type { CollectionName, ConfigName, EventConfig, Id, RolesConfig } from '../types/model'

export interface CoreData {
  cfg: EventConfig | null
  roles: RolesConfig | null
  col: CollectionData
  /** The event owner's email. Always Festival admin. */
  owner: Id | null
  /** Live: stored document files must have keys starting with this (the event's own folder). */
  blobPrefix?: string
}

/** Persistence, called synchronously after each validated change (SQLite in the Durable Object). */
export interface CoreStorage {
  putDoc(col: CollectionName, id: Id, doc: object | null): void
  putConfig(which: ConfigName, doc: object): void
  appendAudit(e: AuditEntry): void
}

export type Effect =
  | { kind: 'doc'; col: CollectionName; change: DocChange<{ id: Id }> }
  | { kind: 'config'; which: ConfigName }

export type ApplyResult =
  | { ok: true; effects: Effect[] }
  | { ok: false; code: 'denied' | 'not_found' | 'invalid'; message: string }

/** Largest record accepted, as JSON. Keeps one bad write from filling the event's storage. */
const MAX_DOC_BYTES = 64 * 1024

const isPlain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

export class EventCore {
  cfg: EventConfig | null
  roles: RolesConfig | null
  col: CollectionData
  owner: Id | null
  private readonly blobPrefix: string | undefined
  private readonly storage: CoreStorage

  constructor(data: CoreData, storage: CoreStorage) {
    this.cfg = data.cfg
    this.roles = data.roles
    this.col = { ...emptyCollections(), ...data.col }
    this.owner = data.owner
    this.blobPrefix = data.blobPrefix
    this.storage = storage
  }

  access(email: Id | null): Access {
    return createAccess({
      me: email, isOwner: !!email && email === this.owner, roles: this.roles,
      members: this.col.members, stageteam: this.col.stageteam, stages: this.col.stages,
    })
  }

  /** Everyone who belongs to the event: owner, members and stage crew. */
  memberEmails(): Id[] {
    const s = new Set<Id>(Object.keys(this.col.members))
    for (const t of Object.values(this.col.stageteam)) for (const u of Object.keys(t.crew ?? {})) s.add(u)
    if (this.owner) s.add(this.owner)
    return [...s]
  }

  /* ---------------- writes ---------------- */

  apply(email: Id, op: WriteOp, now: number): ApplyResult {
    if (!email) return { ok: false, code: 'denied', message: 'Not signed in.' }
    const a = this.access(email)
    if (op.kind === 'setConfig') return this.applyConfig(a, op.which, op.doc, now)
    if (!(COLLECTIONS as readonly string[]).includes(op.col)) return { ok: false, code: 'invalid', message: 'Unknown collection.' }
    const mod = moduleOfCollection(op.col)
    if (mod && !moduleOn(this.cfg, mod)) return { ok: false, code: 'denied', message: `${MODULES[mod].label} is switched off for this event.` }

    const docs: { id: Id; next: Record<string, unknown> | null }[] = []
    if (op.kind === 'set') docs.push({ id: op.id, next: op.doc })
    else if (op.kind === 'setMany') {
      if (!Array.isArray(op.docs) || op.docs.length > 500) return { ok: false, code: 'invalid', message: 'Send 1–500 records at a time.' }
      for (const d of op.docs) docs.push({ id: d?.id, next: d })
    } else if (op.kind === 'delete') docs.push({ id: op.id, next: null })
    else if (op.kind === 'update') {
      const prev = this.col[op.col][op.id] as unknown as Record<string, unknown> | undefined
      if (!prev) return { ok: false, code: 'not_found', message: `${op.col}/${op.id} does not exist.` }
      if (!isPlain(op.patch)) return { ok: false, code: 'invalid', message: 'Bad update.' }
      docs.push({ id: op.id, next: deepMerge(prev, decodePatch(op.patch)) as Record<string, unknown> })
    }

    // Validate everything first, so a batch is all or nothing.
    const planned: { id: Id; prev: { id: Id } | null; next: { id: Id } | null }[] = []
    for (const { id, next: raw } of docs) {
      if (typeof id !== 'string' || !id || id.length > 200) return { ok: false, code: 'invalid', message: 'Every record needs an id.' }
      const prev = (this.col[op.col][id] ?? null) as { id: Id } | null
      if (op.kind === 'delete' && !prev) continue
      let next: Record<string, unknown> | null = null
      if (raw) {
        if (!isPlain(raw)) return { ok: false, code: 'invalid', message: 'Bad record.' }
        next = this.keepHidden(a, op.col, prev as Record<string, unknown> | null, { ...raw, id })
        if (op.col === 'msgs' && !prev) next.at = now // the server's clock, not the sender's
        if (op.col === 'files') { const bad = this.badFile(next); if (bad) return { ok: false, code: 'invalid', message: bad } }
        if (JSON.stringify(next).length > MAX_DOC_BYTES) return { ok: false, code: 'invalid', message: 'That record is too large.' }
      }
      const verdict = canWrite(a, { col: op.col, id, prev, next: next as { id: Id } | null } as Parameters<typeof canWrite>[1], {
        artistStage: aid => this.col.artists[aid]?.stage,
        facilityStage: fid => this.col.facilities[fid]?.stage ?? null,
      })
      if (!verdict.ok) return { ok: false, code: 'denied', message: verdict.reason }
      planned.push({ id, prev, next: next as { id: Id } | null })
    }

    const effects: Effect[] = []
    for (const { id, prev, next } of planned) {
      const c = this.col[op.col] as Record<Id, unknown>
      if (next) c[id] = next
      else delete c[id]
      this.storage.putDoc(op.col, id, next)
      this.storage.appendAudit({
        at: now, actor: email, op: op.kind === 'setMany' ? 'set' : op.kind, col: op.col, id,
        ...(op.kind === 'update' ? { patch: op.patch } : {}),
      })
      effects.push({ kind: 'doc', col: op.col, change: next ? { type: prev ? 'modified' : 'added', id, doc: next } : { type: 'removed', id } })
    }
    return { ok: true, effects }
  }

  private applyConfig(a: Access, which: ConfigName, doc: unknown, now: number): ApplyResult {
    const v = canWriteConfig(a, which)
    if (!v.ok) return { ok: false, code: 'denied', message: v.reason }
    if (!isPlain(doc)) return { ok: false, code: 'invalid', message: 'Bad settings.' }
    if (which === 'event') {
      const c = doc as unknown as EventConfig
      if (c.schema !== SCHEMA_VERSION || typeof c.name !== 'string' || !Array.isArray(c.depts)) return { ok: false, code: 'invalid', message: 'Bad event settings.' }
      this.cfg = c
    } else {
      const r = doc as unknown as RolesConfig
      if (!isPlain(r.roles)) return { ok: false, code: 'invalid', message: 'Bad roles.' }
      // The locked roles can't be changed or removed.
      this.roles = { roles: { ...r.roles, admin: DEFAULT_ROLES.admin, none: DEFAULT_ROLES.none } }
    }
    const stored = which === 'event' ? this.cfg! : this.roles!
    this.storage.putConfig(which, stored)
    this.storage.appendAudit({ at: now, actor: a.me, op: 'setConfig', col: `config/${which}`, id: which })
    return { ok: true, effects: [{ kind: 'config', which }] }
  }

  /** Links must be web links; stored files must live in this event's own storage folder. */
  private badFile(doc: Record<string, unknown>): string | null {
    const url = doc.url as string | undefined
    if (url !== undefined && !/^https?:\/\//i.test(url)) return 'Links must start with https:// or http://.'
    const key = (doc.blob as { key?: unknown } | undefined)?.key
    if (key !== undefined) {
      if (typeof key !== 'string') return 'Bad file.'
      if (this.blobPrefix ? !key.startsWith(this.blobPrefix) : !key.startsWith('data:')) return 'That file isn’t part of this event.'
    }
    return null
  }

  /**
   * A writer who can't see a field (redacted in what they were sent) mustn't wipe it.
   * Restores those fields from the stored record.
   */
  private keepHidden(a: Access, col: CollectionName, prev: Record<string, unknown> | null, next: Record<string, unknown>) {
    if (!prev) return next
    if (col === 'artists' && !a.artistContacts(prev as { stage: Id })) return { ...next, contacts: prev.contacts }
    if (!seesSensitive(a)) {
      if (col === 'hotels') return { ...next, address: prev.address, contact: prev.contact, phone: prev.phone }
      if (col === 'bookings') return { ...next, conf: prev.conf }
    }
    return next
  }

  /* ---------------- reads ---------------- */

  /** Whether a user may see any event data beyond the basics. */
  private hasAccess(a: Access): boolean {
    return !!a.me && (a.me === this.owner || !a.hasNoAccess())
  }

  /** One record as a user may see it: null if hidden, otherwise possibly redacted. */
  viewDoc(a: Access, col: CollectionName, doc: Record<string, unknown>): Record<string, unknown> | null {
    const id = doc.id as Id
    const mod = moduleOfCollection(col)
    if (mod && !moduleOn(this.cfg, mod)) return null
    if (col === 'prefs') return id === a.me ? doc : null
    if (col === 'requests') {
      const stage = doc.stage as Id | null | undefined
      return id === a.me || a.canW('admin') || (!!stage && a.canW('setup', stage)) ? doc : null
    }
    if (!this.hasAccess(a)) return col === 'stages' ? doc : null
    if (col === 'risks') return a.lv('risk', this.col.artists[doc.artist as Id]?.stage) >= 1 ? doc : null
    if (col === 'lines' || col === 'plots') return a.lv('technical', this.col.artists[doc.artist as Id]?.stage) >= 1 ? doc : null
    if (col === 'risers') return a.lv('technical', doc.stage as Id) >= 1 ? doc : null
    if (col === 'transfers') return a.lv('transport', doc.artist ? this.col.artists[doc.artist as Id]?.stage : null) >= 1 ? doc : null
    if (col === 'allocations') return a.lv('facilities', this.col.facilities[doc.facility as Id]?.stage ?? null) >= 1 ? doc : null
    if (col === 'files') {
      const stage = (doc.stage as Id | null) ?? (doc.artist ? this.col.artists[doc.artist as Id]?.stage : null) ?? null
      // Event-wide documents (site plan, safety) are for everyone with document access anywhere.
      return (stage ? a.lv('documents', stage) : a.anyLv('documents')) >= 1 ? doc : null
    }
    if (col === 'msgs') return a.canSeeMsg(doc as unknown as Parameters<Access['canSeeMsg']>[0]) ? doc : null
    if (col === 'artists' && !a.artistContacts(doc as { stage: Id })) return { ...doc, contacts: [] }
    if (!seesSensitive(a)) {
      if (col === 'hotels') { const { address: _a, contact: _c, phone: _p, ...rest } = doc; return rest }
      if (col === 'bookings') { const { conf: _c, ...rest } = doc; return rest }
    }
    return doc
  }

  /** Everything a user may see, for the first message after they connect. */
  snapshotFor(email: Id): Snapshot {
    const a = this.access(email)
    const col: Snapshot['col'] = {}
    for (const c of COLLECTIONS) {
      const out: Record<Id, unknown> = {}
      for (const [id, d] of Object.entries(this.col[c])) {
        const v = this.viewDoc(a, c, d as unknown as Record<string, unknown>)
        if (v) out[id] = v
      }
      col[c] = out
    }
    return { cfg: this.cfg, roles: this.roles ? { roles: mergeRoles(this.roles) } : null, col }
  }

  /** A change as one user sees it. A record they can't see becomes a removal (or nothing). */
  viewChange(email: Id, col: CollectionName, ch: DocChange<{ id: Id }>): DocChange<unknown> {
    if (ch.type === 'removed') return ch
    const v = this.viewDoc(this.access(email), col, ch.doc as unknown as Record<string, unknown>)
    return v ? { ...ch, doc: v } : { type: 'removed', id: ch.id }
  }

  /** Whether these effects can change who sees what, so every viewer needs a fresh snapshot. */
  static changesAccess(effects: Effect[]): boolean {
    // Event settings include which modules are on, which changes what gets sent.
    return effects.some(e => e.kind === 'config' || e.col === 'members' || e.col === 'stageteam')
  }
}

/** Hotel contact details and booking references follow the "contacts" right. */
export function seesSensitive(a: Access): boolean {
  return a.role() === 'admin' || !!a.roleDef().contacts
}
