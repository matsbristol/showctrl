/*
 * SupabaseStore against a fake client: what it sends, and that refused
 * writes are put back with a StoreError the UI can show.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { StoreError } from './store'
import { SupabaseStore, toStoreError } from './supabaseStore'

type Result = { data?: unknown; error?: { code?: string; message?: string } | null }

/** Records every call; `respond` decides each result. A query builder is a thenable chain. */
function fakeClient(respond: (call: { table?: string; rpc?: string; op: string; args: unknown[] }) => Result) {
  const calls: { table?: string; rpc?: string; op: string; args: unknown[] }[] = []
  const builder = (table: string) => {
    let op = 'select'
    let args: unknown[] = []
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'range', 'match']) {
      chain[m] = (...a: unknown[]) => { if (m === 'select' && op !== 'select') return chain; if (m !== 'select') args.push([m, ...a]); return chain }
    }
    for (const m of ['upsert', 'update', 'delete']) chain[m] = (...a: unknown[]) => { op = m; args = [...a]; return chain }
    const finish = () => { const c = { table, op, args }; calls.push(c); return { data: null, error: null, ...respond(c) } }
    chain.maybeSingle = () => Promise.resolve(finish())
    chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(finish()).then(ok, bad)
    return chain
  }
  const sb = {
    from: builder,
    rpc: (name: string, a: unknown) => { const c = { rpc: name, op: 'rpc', args: [a] }; calls.push(c); return Promise.resolve({ data: null, error: null, ...respond(c) }) },
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch },
    removeChannel: () => Promise.resolve(),
  }
  return { sb: sb as unknown as SupabaseClient, calls }
}

const EVENT_ROW = { id: 'ev1', owner: 'u1', cfg: { name: 'Fest' }, roles: {} }
const loadOk = (c: { table?: string; op: string }): Result | null =>
  c.table === 'events' ? { data: EVENT_ROW }
    : c.table === 'docs' && c.op === 'select' ? { data: [{ col: 'stages', id: 'main', doc: { name: 'Main', tape: 'red', order: 1 } }] }
      : null

describe('SupabaseStore', () => {
  it('loads the event and its documents, with ids from the key', async () => {
    const { sb } = fakeClient(c => loadOk(c) ?? {})
    const store = new SupabaseStore(sb, 'ev1')
    expect(await store.start()).toBe(true)
    expect(store.snapshot().cfg?.name).toBe('Fest')
    expect(store.get('stages', 'main')).toMatchObject({ id: 'main', name: 'Main' })
    expect(store.snapshot().roles.admin).toBeTruthy()
    expect(store.owner).toBe('u1')
  })

  it('reports no access when the event is not visible', async () => {
    const { sb } = fakeClient(c => (c.table === 'events' ? { data: null } : {}))
    expect(await new SupabaseStore(sb, 'ev1').start()).toBe(false)
  })

  it('upserts the body without its id', async () => {
    const { sb, calls } = fakeClient(c => loadOk(c) ?? {})
    const store = new SupabaseStore(sb, 'ev1')
    await store.start()
    await store.set('hotels', 'h1', { name: 'Grand' })
    const up = calls.find(c => c.op === 'upsert')!
    expect(up.args[0]).toEqual({ event_id: 'ev1', col: 'hotels', id: 'h1', doc: { name: 'Grand' } })
    expect(store.get('hotels', 'h1')?.name).toBe('Grand')
  })

  it('puts a refused write back and says why', async () => {
    const { sb } = fakeClient(c => loadOk(c) ?? (c.op === 'upsert' ? { error: { code: '42501', message: 'new row violates row-level security policy' } } : {}))
    const store = new SupabaseStore(sb, 'ev1')
    await store.start()
    const err = await store.set('stages', 'main', { name: 'Renamed', tape: 'red', order: 1 }).catch(e => e)
    expect(err).toBeInstanceOf(StoreError)
    expect(err.code).toBe('permission_denied')
    expect(store.get('stages', 'main')?.name).toBe('Main')
  })

  it('merges updates on the server through doc_patch', async () => {
    const { sb, calls } = fakeClient(c => loadOk(c) ?? {})
    const store = new SupabaseStore(sb, 'ev1')
    await store.start()
    await store.update('stages', 'main', { radio: '4' })
    expect(calls.find(c => c.rpc === 'doc_patch')?.args[0]).toEqual({ ev: 'ev1', c: 'stages', i: 'main', patch: { radio: '4' } })
    expect(store.get('stages', 'main')).toMatchObject({ name: 'Main', radio: '4' })
  })

  it('treats a delete that removed nothing as refused', async () => {
    const { sb } = fakeClient(c => loadOk(c) ?? (c.op === 'delete' ? { data: [] } : {}))
    const store = new SupabaseStore(sb, 'ev1')
    await store.start()
    await expect(store.delete('stages', 'main')).rejects.toMatchObject({ code: 'permission_denied' })
    expect(store.get('stages', 'main')).toBeTruthy()
  })
})

describe('toStoreError', () => {
  it('maps database errors to store errors', () => {
    expect(toStoreError({ code: '42501' }).code).toBe('permission_denied')
    expect(toStoreError({ code: 'P0002' }).code).toBe('not_found')
    expect(toStoreError({ message: 'fetch failed' }).code).toBe('unavailable')
  })
})
