import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from '../types/model'
import { LocalStore, emptySnapshot } from './localStore'
import { StoreError } from './store'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v },
    removeItem: (k: string) => { delete data[k] },
  }
}

function seed(): Snapshot {
  const s = emptySnapshot()
  s.cfg = { schema: 2, name: 'Test fest', type: 'festival', tz: 'Europe/Oslo', start: '2026-07-02', end: '2026-07-04', terms: { performer: 'Artist', performers: 'Artists', stage: 'Stage', stages: 'Stages' }, modules: {}, depts: [] }
  s.col.stages.main = { id: 'main', name: 'Main Stage', tape: 'red', order: 0 }
  s.col.artists.a1 = { id: 'a1', name: 'Hollow Pines', stage: 'main', status: 'confirmed', contacts: [{ id: 'c1', role: 'Tour manager', name: 'Eva' }] }
  return s
}

describe('LocalStore', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts from the seed and saves it when nothing is stored', () => {
    const storage = memoryStorage()
    const store = new LocalStore({ storage, key: 'k', seed })
    expect(store.snapshot().cfg?.name).toBe('Test fest')
    expect(JSON.parse(storage.data.k).col.stages.main.name).toBe('Main Stage')
  })

  it('prefers saved data over the seed, and fills in missing collections', () => {
    const saved = { cfg: { ...seed().cfg, name: 'Saved fest' }, col: { stages: {} } }
    const store = new LocalStore({ storage: memoryStorage({ k: JSON.stringify(saved) }), key: 'k', seed })
    expect(store.snapshot().cfg?.name).toBe('Saved fest')
    expect(store.snapshot().col.ros).toEqual({})
    expect(store.snapshot().roles.admin.label).toBe('Festival admin')
  })

  it('falls back to the seed when stored data is corrupt', () => {
    const store = new LocalStore({ storage: memoryStorage({ k: '{nope' }), key: 'k', seed })
    expect(store.snapshot().cfg?.name).toBe('Test fest')
  })

  it('sets, updates and deletes documents', async () => {
    const store = new LocalStore({ storage: null, seed })
    await store.set('stages', 'tent', { name: 'The Tent', tape: 'yellow', order: 1 })
    expect(store.get('stages', 'tent')).toEqual({ id: 'tent', name: 'The Tent', tape: 'yellow', order: 1 })

    await store.update('stages', 'tent', { radio: 'Ch 4', template: { changeover: 20 } })
    await store.update('stages', 'tent', { template: { loadinDur: 30 } })
    expect(store.get('stages', 'tent')).toMatchObject({ name: 'The Tent', radio: 'Ch 4', template: { changeover: 20, loadinDur: 30 } })

    await store.delete('stages', 'tent')
    expect(store.get('stages', 'tent')).toBeUndefined()
    await store.delete('stages', 'tent') // no-op, no throw
  })

  it('replaces arrays on update instead of merging them', async () => {
    const store = new LocalStore({ storage: null, seed })
    await store.update('artists', 'a1', { contacts: [] })
    expect(store.get('artists', 'a1')!.contacts).toEqual([])
  })

  it('refuses to update a missing document', async () => {
    const store = new LocalStore({ storage: null, seed })
    await expect(store.update('stages', 'nope', { name: 'x' })).rejects.toBeInstanceOf(StoreError)
    await expect(store.update('stages', 'nope', { name: 'x' })).rejects.toMatchObject({ code: 'not_found' })
  })

  it('replaces the snapshot on change and keeps untouched collections', async () => {
    const store = new LocalStore({ storage: null, seed })
    const before = store.snapshot()
    await store.setMany('ros', [
      { id: 'r1', stage: 'main', kind: 'show', title: 'A', start: 1, end: 2, status: 'pending', delay: 0 },
      { id: 'r2', stage: 'main', kind: 'show', title: 'B', start: 3, end: 4, status: 'pending', delay: 0 },
    ])
    const after = store.snapshot()
    expect(after).not.toBe(before)
    expect(after.col.ros).not.toBe(before.col.ros)
    expect(after.col.stages).toBe(before.col.stages)
    expect(Object.keys(after.col.ros)).toEqual(['r1', 'r2'])
    expect(before.col.ros).toEqual({})
  })

  it('notifies subscribers until they unsubscribe', async () => {
    const store = new LocalStore({ storage: null, seed })
    const seen: string[] = []
    const off = store.subscribe(s => seen.push(s.cfg!.name))
    await store.setEvent({ ...store.snapshot().cfg!, name: 'Renamed' })
    off()
    await store.setEvent({ ...store.snapshot().cfg!, name: 'Again' })
    expect(seen).toEqual(['Renamed'])
  })

  it('keeps built-in roles when roles are replaced', async () => {
    const store = new LocalStore({ storage: null, seed })
    await store.setRoles({ runner: { label: 'Runner', perms: { ...store.snapshot().roles.none.perms, messages: 2 }, contacts: false } })
    expect(Object.keys(store.snapshot().roles)).toEqual(expect.arrayContaining(['admin', 'none', 'runner']))
  })

  it('debounces saving', async () => {
    const storage = memoryStorage()
    const store = new LocalStore({ storage, key: 'k', seed, saveDelay: 400 })
    await store.update('stages', 'main', { name: 'Big Stage' })
    expect(JSON.parse(storage.data.k).col.stages.main.name).toBe('Main Stage')
    vi.advanceTimersByTime(400)
    expect(JSON.parse(storage.data.k).col.stages.main.name).toBe('Big Stage')
  })

  it('reset replaces everything and saves at once', () => {
    const storage = memoryStorage()
    const store = new LocalStore({ storage, key: 'k', seed })
    store.reset(emptySnapshot())
    expect(store.snapshot().cfg).toBeNull()
    expect(JSON.parse(storage.data.k).cfg).toBeNull()
  })
})
