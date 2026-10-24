// One Durable Object per event. Holds the event's data in SQLite, keeps WebSockets open
// (hibernation API, so idle connections cost nothing), and delegates all rules to
// EventCore / EventHub in src/server.

import { DurableObject } from 'cloudflare:workers'
import type { AuditEntry } from '../src/data/store'
import { emptyCollections } from '../src/data/collections'
import { EventCore, type CollectionData, type CoreData } from '../src/server/core'
import { EventHub, type Peer } from '../src/server/hub'
import { COLLECTIONS } from '../src/types/constants'
import { moduleOn } from '../src/shared/modules'
import type { WriteOp } from '../src/shared/protocol'
import type { CollectionName, ConfigName, EventConfig, FileDoc, Id, RolesConfig } from '../src/types/model'
import type { Env } from './env'

const EMAIL_HEADER = 'x-showctrl-email'

export class EventObject extends DurableObject<Env> {
  private hub!: EventHub

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.migrate()
      this.hub = this.load()
    })
  }

  private get sql() {
    return this.ctx.storage.sql
  }

  private migrate() {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY)`)
    const v = this.sql.exec<{ v: number }>('SELECT COALESCE(MAX(id), 0) AS v FROM _migrations').one().v
    if (v < 1) {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (col, id));
        CREATE TABLE IF NOT EXISTS config (which TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT, op TEXT NOT NULL,
          col TEXT NOT NULL, doc_id TEXT NOT NULL, patch TEXT
        );
        INSERT INTO _migrations (id) VALUES (1);
      `)
    }
  }

  private meta(key: string): string | null {
    return this.sql.exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key).toArray()[0]?.value ?? null
  }

  /** Reads everything into memory. An event is a few thousand records, so this is fast. */
  private load(): EventHub {
    const col = emptyCollections()
    for (const r of this.sql.exec<{ col: string; id: string; data: string }>('SELECT col, id, data FROM docs')) {
      if ((COLLECTIONS as readonly string[]).includes(r.col)) (col[r.col as CollectionName] as Record<Id, unknown>)[r.id] = JSON.parse(r.data)
    }
    const cfgRow = (w: ConfigName) => this.sql.exec<{ data: string }>('SELECT data FROM config WHERE which = ?', w).toArray()[0]?.data
    const data: CoreData = {
      cfg: cfgRow('event') ? JSON.parse(cfgRow('event')!) as EventConfig : null,
      roles: cfgRow('roles') ? JSON.parse(cfgRow('roles')!) as RolesConfig : null,
      col,
      owner: this.meta('owner'),
      superadmins: (this.env.SUPERADMINS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      blobPrefix: `${this.meta('eventId') ?? 'none'}/`,
    }
    const core = new EventCore(data, {
      putDoc: (c, id, doc) => {
        if (c === 'files') this.dropReplacedBlob(id, doc as FileDoc | null)
        if (doc) this.sql.exec('INSERT OR REPLACE INTO docs (col, id, data) VALUES (?, ?, ?)', c, id, JSON.stringify(doc))
        else this.sql.exec('DELETE FROM docs WHERE col = ? AND id = ?', c, id)
      },
      putConfig: (w, doc) => { this.sql.exec('INSERT OR REPLACE INTO config (which, data) VALUES (?, ?)', w, JSON.stringify(doc)) },
      appendAudit: e => {
        this.sql.exec('INSERT INTO audit (at, actor, op, col, doc_id, patch) VALUES (?, ?, ?, ?, ?, ?)',
          e.at, e.actor, e.op, e.col, e.id, e.patch === undefined ? null : JSON.stringify(e.patch))
      },
    })
    return new EventHub(core, {
      peers: () => this.ctx.getWebSockets().map(ws => this.peer(ws)),
      readAudit: n => this.sql.exec<{ at: number; actor: string | null; op: string; col: string; doc_id: string; patch: string | null }>(
        'SELECT at, actor, op, col, doc_id, patch FROM audit ORDER BY seq DESC LIMIT ?', n,
      ).toArray().map(r => ({
        at: r.at, actor: r.actor, op: r.op as AuditEntry['op'], col: r.col as AuditEntry['col'], id: r.doc_id,
        ...(r.patch ? { patch: JSON.parse(r.patch) } : {}),
      })),
      onMembersChanged: emails => this.ctx.waitUntil(this.syncMembers(emails)),
    })
  }

  /** A deleted document, or one whose file was replaced, takes its stored file with it. */
  private dropReplacedBlob(id: Id, next: FileDoc | null) {
    const row = this.sql.exec<{ data: string }>('SELECT data FROM docs WHERE col = ? AND id = ?', 'files', id).toArray()[0]
    const key = row ? (JSON.parse(row.data) as FileDoc).blob?.key : undefined
    if (key && key !== next?.blob?.key && !key.startsWith('data:')) this.ctx.waitUntil(this.env.FILES?.delete(key) ?? Promise.resolve())
  }

  /** Upload check: may this user add documents for the event, a stage or an act? */
  async canUpload(email: Id, scope: { stage?: Id | null; artist?: Id | null }): Promise<boolean> {
    const core = this.hub.core
    if (!moduleOn(core.cfg, 'documents')) return false
    const stage = scope.stage ?? (scope.artist ? core.col.artists[scope.artist]?.stage : null) ?? null
    return core.access(email).canW('documents', stage)
  }

  /** Download check: the document with this stored file, if this user may see it. */
  async fileFor(email: Id, key: string): Promise<{ name: string; type: string } | null> {
    const core = this.hub.core
    const doc = Object.values(core.col.files).find(f => f.blob?.key === key)
    if (!doc || !moduleOn(core.cfg, 'documents')) return null
    const seen = core.viewDoc(core.access(email), 'files', doc as unknown as Record<string, unknown>)
    return seen ? { name: doc.name, type: doc.blob!.type } : null
  }

  private peer(ws: WebSocket): Peer {
    const { email } = ws.deserializeAttachment() as { email: Id }
    return { email, send: d => ws.send(d) }
  }

  /** Mirrors who belongs to this event into D1, so /api/me can list a user's events. */
  private async syncMembers(emails: Id[]) {
    const id = this.meta('eventId')
    if (!id) return
    await this.env.DB.batch([
      this.env.DB.prepare('DELETE FROM memberships WHERE event_id = ?').bind(id),
      ...emails.map(e => this.env.DB.prepare('INSERT OR IGNORE INTO memberships (event_id, email) VALUES (?, ?)').bind(id, e)),
    ])
  }

  /* ---------------- RPC from the Worker ---------------- */

  /** Creates the event's data. Does nothing if it already exists. */
  async init(eventId: Id, owner: Id, data: { cfg: EventConfig; roles: RolesConfig; col: CollectionData }): Promise<void> {
    if (this.meta('eventId')) return
    this.sql.exec('INSERT INTO meta (key, value) VALUES (?, ?), (?, ?)', 'eventId', eventId, 'owner', owner)
    this.sql.exec('INSERT OR REPLACE INTO config (which, data) VALUES (?, ?), (?, ?)', 'event', JSON.stringify(data.cfg), 'roles', JSON.stringify(data.roles))
    for (const c of COLLECTIONS) {
      for (const [id, doc] of Object.entries(data.col[c] ?? {})) this.sql.exec('INSERT OR REPLACE INTO docs (col, id, data) VALUES (?, ?, ?)', c, id, JSON.stringify(doc))
    }
    this.hub = this.load()
    await this.syncMembers(this.hub.core.memberEmails())
  }

  /**
   * Organisation admins are Festival admin in every event of their organisation.
   * Made through the normal write rules, as the owner, so it shows in the change history.
   * Removing takes away their membership only if it is the admin one (the owner always stays).
   */
  async setOrgAdmin(email: Id, on: boolean): Promise<void> {
    const core = this.hub.core
    const owner = core.owner
    if (!owner || email === owner) return
    const cur = core.col.members[email]
    let op: WriteOp | null = null
    if (on && cur?.role !== 'admin') {
      op = { kind: 'set', col: 'members', id: email, doc: { ...(cur ?? { name: email, stages: {}, person: null, depts: [] }), id: email, role: 'admin' } }
    } else if (!on && cur?.role === 'admin') {
      op = { kind: 'delete', col: 'members', id: email }
    }
    if (!op) return
    const r = core.apply(owner, op, Date.now())
    if (r.ok) this.hub.broadcast(r.effects)
    else console.error(JSON.stringify({ level: 'error', what: 'setOrgAdmin', email, error: r.message }))
  }

  /* ---------------- WebSockets ---------------- */

  async fetch(request: Request): Promise<Response> {
    const email = request.headers.get(EMAIL_HEADER)
    if (!email || request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 400 })
    if (!this.meta('eventId')) return new Response('No such event', { status: 404 })
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ email })
    this.hub.connect(this.peer(server))
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return
    this.hub.message(this.peer(ws), message)
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code) } catch { /* already closed */ }
  }
}

export { EMAIL_HEADER }
