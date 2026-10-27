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
import { personName } from '../src/shared/people'
import { sendInvite } from './invite'
import { trIn } from '../src/i18n'
import { accredLevels } from '../src/lib/accred'
import { buildSample, SAMPLE_NAME } from '../src/data/sample'
import type { ImportContext } from '../src/shared/importSchema'
import type { WriteOp } from '../src/shared/protocol'
import type { CollectionName, ConfigName, EventConfig, FileDoc, Id, RolesConfig } from '../src/types/model'
import type { Env } from './env'

const EMAIL_HEADER = 'x-showctrl-email'
/** The name the person gave showctrl (users.name), so their entry here can show it. */
const NAME_HEADER = 'x-showctrl-name'

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
      onNewMembers: (emails, by) => this.ctx.waitUntil(this.invite(emails, by)),
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

  /**
   * Import check: event admins only, at most 30 reads an hour per event (each one costs money).
   * Returns what the event already has, so Claude can match names to it.
   */
  async importContext(email: Id): Promise<ImportContext | 'denied' | 'busy'> {
    const core = this.hub.core
    if (!core.access(email).canW('admin')) return 'denied'
    const now = Date.now()
    const recent = (JSON.parse(this.meta('imports') ?? '[]') as number[]).filter(t => t > now - 3_600_000)
    if (recent.length >= 30) return 'busy'
    this.sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'imports', JSON.stringify([...recent, now]))
    const cfg = core.cfg
    const names = <T extends { name: string }>(r: Record<Id, T>) => Object.values(r).map(x => x.name).sort()
    return {
      name: cfg?.name ?? '', type: cfg?.type ?? 'festival', tz: cfg?.tz ?? 'Europe/Oslo', start: cfg?.start, end: cfg?.end,
      stages: names(core.col.stages), artists: names(core.col.artists), hotels: names(core.col.hotels),
      depts: (cfg?.depts ?? []).map(d => d.name), accred: accredLevels(cfg),
    }
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
   * Superadmins: rebuilds the sample festival so day 1 is today at real festival hours.
   * Only for the sample (by name). Keeps real people's access (members and stage crew with an
   * email), their preferences and requests, uploaded files, the roles and which modules are on.
   * Everyone connected reconnects and gets the new data.
   */
  async resetSample(now: number): Promise<{ records: number } | 'not-sample'> {
    const core = this.hub.core
    if (core.cfg?.name !== SAMPLE_NAME) return 'not-sample'
    const fresh = buildSample(now, { realTimes: true })
    const real = (id: string) => id.includes('@')
    const col = fresh.col as unknown as CollectionData
    for (const [id, m] of Object.entries(core.col.members)) if (real(id)) (col.members as Record<Id, unknown>)[id] = m
    for (const [sid, team] of Object.entries(core.col.stageteam)) {
      const keep = Object.fromEntries(Object.entries(team.crew ?? {}).filter(([u]) => real(u)))
      if (!Object.keys(keep).length) continue
      const st = (col.stageteam as Record<Id, { id: Id; crew: Record<Id, true> }>)
      st[sid] = { id: sid, crew: { ...(st[sid]?.crew ?? {}), ...keep } }
    }
    for (const [id, f] of Object.entries(core.col.files)) if (f.blob && !f.blob.key.startsWith('data:')) (col.files as Record<Id, unknown>)[id] = f
    const cfg = { ...fresh.cfg!, modules: core.cfg.modules, ...(core.cfg.accred ? { accred: core.cfg.accred } : {}) }
    let records = 0
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM docs WHERE col NOT IN ('prefs', 'requests')")
      for (const c of COLLECTIONS) {
        if (c === 'prefs' || c === 'requests') continue
        for (const [id, doc] of Object.entries(col[c] ?? {})) { this.sql.exec('INSERT INTO docs (col, id, data) VALUES (?, ?, ?)', c, id, JSON.stringify(doc)); records++ }
      }
      this.sql.exec('INSERT OR REPLACE INTO config (which, data) VALUES (?, ?)', 'event', JSON.stringify(cfg))
    })
    this.hub = this.load()
    // Everyone reconnects (the app does that on its own) and gets the new snapshot.
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(1012, 'The sample festival was reset.') } catch { /* already closed */ }
    }
    return { records }
  }

  /** Emails the people who just got access: who gave it, and as what. */
  async invite(emails: Id[], by: Id): Promise<void> {
    const core = this.hub.core
    const event = core.cfg?.name ?? 'an event'
    const from = personName(by, core.col.members, core.col.people)
    await Promise.all(emails.filter(e => e !== by).map(async to => {
      // In their own language if they've chosen one; otherwise Norwegian for events in Norway.
      const saved = await this.env.DB.prepare('SELECT lang FROM users WHERE email = ?').bind(to).first<{ lang: string | null }>().catch(() => null)
      const nb = saved?.lang ? saved.lang === 'nb' : core.cfg?.tz === 'Europe/Oslo'
      const a = core.access(to)
      const stageRoles = a.myStages().map(s => `${a.stageRole(s.id) === 'manager' ? 'stage manager' : 'crew'} ${nb ? 'på' : 'on'} ${s.name}`)
      const as = a.role() !== 'none' ? trIn(nb ? 'nb' : 'en', a.roleDef().label) : stageRoles.join(', ') || (nb ? 'medlem' : 'a member')
      return sendInvite(this.env, { to, event, by: from, as, nb })
    }))
  }

  /** The event's admins: the owner and every member with the Festival admin role, with the name shown for each. */
  async admins(): Promise<{ email: Id; name: string }[]> {
    const core = this.hub.core
    const ids = [...new Set([...(core.owner ? [core.owner] : []), ...Object.values(core.col.members).filter(m => m.role === 'admin').map(m => m.id)])]
    return ids.map(email => ({ email, name: personName(email, core.col.members, core.col.people) })).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Superadmins appoint an event's admins from the start page. Made through the normal write
   * rules, as the owner, so it shows in the change history. Removing takes away the membership
   * only if it is the admin one; the owner always stays.
   */
  async setEventAdmin(email: Id, on: boolean, name = '', by = ''): Promise<void> {
    const core = this.hub.core
    const owner = core.owner
    if (!owner || email === owner) return
    const cur = core.col.members[email]
    let op: WriteOp | null = null
    const unnamed = !cur?.name || cur.name === email
    if (on && (cur?.role !== 'admin' || (name && unnamed))) {
      op = { kind: 'set', col: 'members', id: email, doc: { ...(cur ?? { stages: {}, person: null, depts: [] }), name: (unnamed && name) || cur?.name || email, id: email, role: 'admin' } }
    } else if (!on && cur?.role === 'admin') {
      op = { kind: 'delete', col: 'members', id: email }
    }
    if (!op) return
    const isNew = on && !cur
    const r = core.apply(owner, op, Date.now())
    if (r.ok) {
      this.hub.broadcast(r.effects)
      if (isNew && by) await this.invite([email], by)
    } else console.error(JSON.stringify({ level: 'error', what: 'setEventAdmin', email, error: r.message }))
  }

  /** Analytics: changes per person and collection since `since`, from the change log. */
  async auditSummary(since: number): Promise<{ actor: string; col: string; n: number; last: number }[]> {
    return this.sql.exec<{ actor: string; col: string; n: number; last: number }>(
      'SELECT actor, col, COUNT(*) AS n, MAX(at) AS last FROM audit WHERE at >= ? AND actor IS NOT NULL GROUP BY actor, col', since,
    ).toArray()
  }

  /** How much the event holds; `exists` is false for an empty object. */
  async counts(): Promise<{ exists: boolean; records: number; history: number }> {
    const n = (sql: string) => this.sql.exec<{ n: number }>(sql).one().n
    return { exists: !!this.meta('eventId'), records: n('SELECT COUNT(*) AS n FROM docs'), history: n('SELECT COUNT(*) AS n FROM audit') }
  }

  /** Every stored row as it is, for moving the event to another place (see worker/events.ts). */
  async dumpRaw(): Promise<RawDump> {
    return {
      meta: this.sql.exec<{ key: string; value: string }>('SELECT key, value FROM meta').toArray(),
      config: this.sql.exec<{ which: string; data: string }>('SELECT which, data FROM config').toArray(),
      docs: this.sql.exec<{ col: string; id: string; data: string }>('SELECT col, id, data FROM docs').toArray(),
      audit: this.sql.exec<RawDump['audit'][number]>('SELECT seq, at, actor, op, col, doc_id, patch FROM audit ORDER BY seq').toArray(),
    }
  }

  /** Fills an empty event from `dumpRaw` of another. Refuses if this one already holds an event. */
  async restore(d: RawDump): Promise<void> {
    if (this.meta('eventId')) throw new Error('This event already has data.')
    for (const m of d.meta) this.sql.exec('INSERT INTO meta (key, value) VALUES (?, ?)', m.key, m.value)
    for (const c of d.config) this.sql.exec('INSERT INTO config (which, data) VALUES (?, ?)', c.which, c.data)
    for (const r of d.docs) this.sql.exec('INSERT INTO docs (col, id, data) VALUES (?, ?, ?)', r.col, r.id, r.data)
    for (const a of d.audit) this.sql.exec('INSERT INTO audit (seq, at, actor, op, col, doc_id, patch) VALUES (?, ?, ?, ?, ?, ?, ?)', a.seq, a.at, a.actor, a.op, a.col, a.doc_id, a.patch)
    this.hub = this.load()
  }

  /**
   * Everything stored for the event, unredacted, for a superadmin's backup: settings, every
   * record, the change history and the stored file keys (the files themselves stay in R2).
   */
  async exportAll(): Promise<Record<string, unknown>> {
    const parse = (s: string) => JSON.parse(s) as unknown
    const docs: Record<string, Record<string, unknown>> = {}
    for (const r of this.sql.exec<{ col: string; id: string; data: string }>('SELECT col, id, data FROM docs ORDER BY col, id')) (docs[r.col] ??= {})[r.id] = parse(r.data)
    const config = Object.fromEntries(this.sql.exec<{ which: string; data: string }>('SELECT which, data FROM config').toArray().map(r => [r.which, parse(r.data)]))
    const audit = this.sql.exec<{ at: number; actor: string | null; op: string; col: string; doc_id: string; patch: string | null }>(
      'SELECT at, actor, op, col, doc_id, patch FROM audit ORDER BY seq',
    ).toArray().map(r => ({ at: r.at, actor: r.actor, op: r.op, col: r.col, id: r.doc_id, ...(r.patch ? { patch: parse(r.patch) } : {}) }))
    const files = Object.values(docs.files ?? {}).map(f => (f as { blob?: { key: string } }).blob?.key).filter((k): k is string => !!k && !k.startsWith('data:'))
    return { eventId: this.meta('eventId'), owner: this.meta('owner'), config, collections: docs, audit, storedFiles: files }
  }

  /**
   * Deletes the event for good: its uploaded files, every record, the change history.
   * Open connections are closed with code 4004. The Worker removes it from D1 first.
   */
  async destroy(keepFiles = false): Promise<void> {
    const id = keepFiles ? null : this.meta('eventId')
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(4004, 'This event was deleted.') } catch { /* already closed */ }
    }
    if (id && this.env.FILES) {
      let cursor: string | undefined
      do {
        const page = await this.env.FILES.list({ prefix: `${id}/`, cursor })
        if (page.objects.length) await this.env.FILES.delete(page.objects.map(o => o.key))
        cursor = page.truncated ? page.cursor : undefined
      } while (cursor)
    }
    await this.ctx.storage.deleteAll()
    this.migrate()
    this.hub = this.load()
  }

  /**
   * Shows the name a person chose in this event. `onlyIfUnnamed`: on connect, fill in a name an
   * admin never set (still blank or the email), without overwriting one they typed.
   */
  async setMemberName(email: Id, name: string, onlyIfUnnamed = false): Promise<void> {
    const core = this.hub.core
    const m = core.col.members[email]
    if (!m || !core.owner || m.name === name) return
    if (onlyIfUnnamed && m.name && m.name !== email) return
    const r = core.apply(core.owner, { kind: 'update', col: 'members', id: email, patch: { name } }, Date.now())
    if (r.ok) this.hub.broadcast(r.effects)
  }

  /* ---------------- WebSockets ---------------- */

  async fetch(request: Request): Promise<Response> {
    const email = request.headers.get(EMAIL_HEADER)
    if (!email || request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 400 })
    if (!this.meta('eventId')) return new Response('No such event', { status: 404 })
    const name = request.headers.get(NAME_HEADER)
    if (name) await this.setMemberName(email, decodeURIComponent(name), true)
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

export { EMAIL_HEADER, NAME_HEADER }

export interface RawDump {
  meta: { key: string; value: string }[]
  config: { which: string; data: string }[]
  docs: { col: string; id: string; data: string }[]
  audit: { seq: number; at: number; actor: string | null; op: string; col: string; doc_id: string; patch: string | null }[]
}
