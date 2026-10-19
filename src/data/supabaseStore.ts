/*
 * DataStore backed by Supabase: one event's data, kept in memory and in step
 * with the database through realtime.
 *
 * Storage (supabase/migrations): `events` holds config/event (`cfg`) and
 * config/roles (`roles`); every collection record is a row in `docs`
 * (event_id, col, id, doc). Row-level security decides what each person can
 * read and write, so the snapshot only ever holds what they may see.
 *
 * Writes are optimistic: the snapshot changes at once, and is put back if
 * the database refuses, with a StoreError the UI can show.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { CollectionName, Collections, EventConfig, Id, Roles, Snapshot } from '../types/model'
import { COLLECTIONS, DEFAULT_ROLES } from '../domain/constants'
import { deepMerge, emptySnapshot } from './localStore'
import { StoreError, type DataStore, type DeepPartial, type DocInput, type Listener } from './store'

/** PostgREST returns at most this many rows per request. */
const PAGE = 1000

interface DocRow {
  event_id: string
  col: CollectionName
  id: Id
  doc: Record<string, unknown>
}

interface EventRow {
  id: string
  owner: string
  cfg: EventConfig | null
  roles: Roles | null
}

/** Turns a Postgres / PostgREST error into the StoreError the UI expects. */
export function toStoreError(e: { code?: string; message?: string } | null | undefined): StoreError {
  const code = e?.code ?? ''
  const msg = e?.message ?? ''
  if (code === '42501' || /row-level security|permission denied/i.test(msg))
    return new StoreError('permission_denied', 'You don’t have permission to change that.')
  if (code === 'P0002') return new StoreError('not_found', 'That record no longer exists, or you can’t change it.')
  return new StoreError('unavailable', 'Couldn’t reach the server. Check your connection and try again.')
}

const isCollection = (c: string): c is CollectionName => (COLLECTIONS as string[]).includes(c)

/** The stored body: everything but the id, which is the key. */
function body(doc: object): Record<string, unknown> {
  const { id: _id, ...rest } = doc as Record<string, unknown>
  return rest
}

export class SupabaseStore implements DataStore {
  private snap: Snapshot = emptySnapshot()
  private listeners = new Set<Listener>()
  private channel: RealtimeChannel | null = null
  private reloadTimer: ReturnType<typeof setTimeout> | null = null
  private loaded = false
  /** The event's owner, who is always Festival admin. */
  owner: Id | null = null
  readonly sb: SupabaseClient
  readonly eventId: string

  constructor(sb: SupabaseClient, eventId: string) {
    this.sb = sb
    this.eventId = eventId
  }

  /**
   * Loads everything this user may see, then follows changes. Resolves false
   * if the event isn't visible to them (no access yet, or no such event).
   */
  async start(): Promise<boolean> {
    if (!(await this.load())) return false
    this.follow()
    return true
  }

  stop(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
    if (this.channel) void this.sb.removeChannel(this.channel)
    this.channel = null
  }

  /* ---------------- reads ---------------- */

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

  /** Reads the event and every visible document, page by page, and replaces the snapshot. */
  async load(): Promise<boolean> {
    const ev = await this.sb.from('events').select('id, owner, cfg, roles').eq('id', this.eventId).maybeSingle<EventRow>()
    if (ev.error) throw toStoreError(ev.error)
    if (!ev.data) return false

    const next = emptySnapshot()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb.from('docs')
        .select('col, id, doc')
        .eq('event_id', this.eventId)
        .order('col').order('id')
        .range(from, from + PAGE - 1)
      if (error) throw toStoreError(error)
      for (const r of (data ?? []) as Omit<DocRow, 'event_id'>[]) {
        if (isCollection(r.col)) (next.col[r.col] as Record<Id, unknown>)[r.id] = { ...r.doc, id: r.id }
      }
      if (!data || data.length < PAGE) break
    }
    this.owner = ev.data.owner
    this.loaded = true
    this.commit({ cfg: ev.data.cfg, roles: { ...DEFAULT_ROLES, ...ev.data.roles }, col: next.col })
    return true
  }

  /* ---------------- realtime ---------------- */

  /**
   * Subscribes to this event's changes. Row-level security applies, so only
   * rows this user may read arrive. Deletes can't be filtered by event in
   * Supabase realtime, so they're checked here (the old row carries the
   * primary key, which includes the event).
   */
  private follow() {
    // Once only, even if start() runs twice (React StrictMode, "Try again").
    if (this.channel) return
    const ev = this.eventId
    this.channel = this.sb.channel(`event:${ev}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'docs', filter: `event_id=eq.${ev}` }, p => this.onRow(p.new as DocRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'docs', filter: `event_id=eq.${ev}` }, p => this.onRow(p.new as DocRow))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'docs' }, p => {
        const old = p.old as Partial<DocRow>
        if (old.event_id === ev && old.col && old.id && isCollection(old.col)) this.removeLocal(old.col, old.id)
        if (old.event_id === ev && (old.col === 'members' || old.col === 'stageteam')) this.scheduleReload()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${ev}` }, p => {
        const row = p.new as EventRow
        this.commit({ ...this.snap, cfg: row.cfg, roles: { ...DEFAULT_ROLES, ...row.roles } })
        // A role's permissions changed: what this user may see may have changed too.
        this.scheduleReload()
      })
      .subscribe(status => {
        // After a dropped connection, catch up on anything missed.
        if (status === 'SUBSCRIBED' && this.loaded) this.scheduleReload()
      })
  }

  private onRow(r: DocRow) {
    if (!isCollection(r.col)) return
    this.putLocal(r.col, { ...r.doc, id: r.id } as unknown as Collections[typeof r.col])
    // Access changes (someone given a role, added to a crew) change which rows
    // this user can see, and realtime only sends rows as they change, so reload.
    if (r.col === 'members' || r.col === 'stageteam') this.scheduleReload()
  }

  private scheduleReload() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null
      this.load().catch(e => console.warn('showctrl: reload failed', e))
    }, 300)
  }

  /* ---------------- writes ---------------- */

  async set<K extends CollectionName>(col: K, id: Id, doc: DocInput<K>): Promise<void> {
    const prev = this.snap.col[col][id]
    this.putLocal(col, { ...doc, id } as unknown as Collections[K])
    const { error } = await this.sb.from('docs').upsert({ event_id: this.eventId, col, id, doc: body(doc) })
    if (error) {
      this.restore(col, id, prev)
      throw toStoreError(error)
    }
  }

  /** Merged on the server (`doc_patch`), so simultaneous edits to different fields both land. */
  async update<K extends CollectionName>(col: K, id: Id, patch: DeepPartial<Omit<Collections[K], 'id'>>): Promise<void> {
    const prev = this.snap.col[col][id]
    if (!prev) throw new StoreError('not_found', `${col}/${id} does not exist`)
    this.putLocal(col, { ...deepMerge(prev, patch), id })
    const { error } = await this.sb.rpc('doc_patch', { ev: this.eventId, c: col, i: id, patch: body(patch) })
    if (error) {
      this.restore(col, id, prev)
      throw toStoreError(error)
    }
  }

  async delete(col: CollectionName, id: Id): Promise<void> {
    const prev = this.snap.col[col][id]
    this.removeLocal(col, id)
    // Row-level security makes a refused delete look like "nothing to delete",
    // so ask for the deleted rows back and treat none as refused.
    const { data, error } = await this.sb.from('docs').delete()
      .match({ event_id: this.eventId, col, id }).select('id')
    if (error || (prev && !data?.length)) {
      this.restore(col, id, prev)
      throw error ? toStoreError(error) : new StoreError('permission_denied', 'You don’t have permission to delete that.')
    }
  }

  async setMany<K extends CollectionName>(col: K, docs: Collections[K][]): Promise<void> {
    if (!docs.length) return
    const prev = docs.map(d => [d.id, this.snap.col[col][d.id]] as const)
    for (const d of docs) this.putLocal(col, { ...d })
    const rows = docs.map(d => ({ event_id: this.eventId, col, id: d.id, doc: body(d) }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.sb.from('docs').upsert(rows.slice(i, i + 500))
      if (error) {
        for (const [id, p] of prev) this.restore(col, id, p)
        throw toStoreError(error)
      }
    }
  }

  async setEvent(cfg: EventConfig): Promise<void> {
    await this.writeEvent({ cfg }, { ...this.snap, cfg: { ...cfg } })
  }

  async setRoles(roles: Roles): Promise<void> {
    const all = { ...DEFAULT_ROLES, ...roles }
    await this.writeEvent({ roles: all }, { ...this.snap, roles: all })
  }

  private async writeEvent(fields: Partial<Pick<EventRow, 'cfg' | 'roles'>>, optimistic: Snapshot) {
    const before = this.snap
    this.commit(optimistic)
    const { data, error } = await this.sb.from('events').update(fields).eq('id', this.eventId).select('id')
    if (error || !data?.length) {
      this.commit({ ...this.snap, cfg: before.cfg, roles: before.roles })
      throw error ? toStoreError(error) : new StoreError('permission_denied', 'Only festival admins can change the event settings.')
    }
  }

  /* ---------------- local snapshot ---------------- */

  private putLocal<K extends CollectionName>(col: K, doc: Collections[K]) {
    this.commit({ ...this.snap, col: { ...this.snap.col, [col]: { ...this.snap.col[col], [doc.id]: doc } } })
  }

  private removeLocal(col: CollectionName, id: Id) {
    if (!(id in this.snap.col[col])) return
    const next = { ...this.snap.col[col] }
    delete next[id]
    this.commit({ ...this.snap, col: { ...this.snap.col, [col]: next } })
  }

  /** Puts a document back as it was before a refused write. */
  private restore<K extends CollectionName>(col: K, id: Id, prev: Collections[K] | undefined) {
    if (prev) this.putLocal(col, prev)
    else this.removeLocal(col, id)
  }

  private commit(next: Snapshot) {
    this.snap = next
    for (const l of this.listeners) l(next)
  }
}
