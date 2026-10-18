import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ROLES, SCHEMA_VERSION, defaultDepts, EVENT_TYPES } from '../types/constants'
import type { EventConfig, Stage } from '../types/model'
import { LocalStore, emptyCollections, type LocalData } from './localStore'
import { StoreError } from './store'

const cfg: EventConfig = {
  schema: SCHEMA_VERSION, name: 'Test', type: 'festival', tz: 'Europe/Oslo', start: '2026-07-01', end: '2026-07-03',
  terms: EVENT_TYPES.festival.terms, modules: {}, depts: defaultDepts(),
}
const blank = (): LocalData => ({ cfg, roles: { roles: DEFAULT_ROLES }, col: emptyCollections() })
const stage = (id: string, extra: Partial<Stage> = {}): Stage => ({ id, name: id, tape: 'red', order: 0, ...extra })

class MemStorage implements Storage {
  data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(k: string) { return this.data.get(k) ?? null }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  removeItem(k: string) { this.data.delete(k) }
  setItem(k: string, v: string) { this.data.set(k, v) }
}

const mk = (storage: Storage | null = null) => new LocalStore({ initial: blank, storage, storageKey: storage ? 'k' : null })

afterEach(() => { vi.useRealTimers() })

describe('LocalStore records', () => {
  it('sets and gets a record, with the id from the call', async () => {
    const s = mk()
    await s.set('stages', 'main', { name: 'Main', tape: 'red', order: 0 })
    expect(await s.get('stages', 'main')).toEqual({ id: 'main', name: 'Main', tape: 'red', order: 0 })
    expect(await s.get('stages', 'nope')).toBeNull()
  })

  it('update merges objects, replaces arrays and removes undefined keys', async () => {
    const s = mk()
    await s.set('stages', 'main', stage('main', { template: { arrival: -240, getin: -180 }, location: 'South' }))
    await s.update('stages', 'main', { template: { getin: -120 }, location: undefined })
    expect(s.peek('stages').main).toEqual({ id: 'main', name: 'main', tape: 'red', order: 0, template: { arrival: -240, getin: -120 } })

    await s.set('people', 'p1', { name: 'A', stages: ['main', 'fjord'], lead: false })
    await s.update('people', 'p1', { stages: ['tent'] })
    expect(s.peek('people').p1.stages).toEqual(['tent'])
  })

  it('update on a missing record throws not_found', async () => {
    const s = mk()
    await expect(s.update('stages', 'x', { name: 'y' })).rejects.toMatchObject({ code: 'not_found' })
    await expect(s.update('stages', 'x', { name: 'y' })).rejects.toBeInstanceOf(StoreError)
  })

  it('delete removes a record and ignores missing ids', async () => {
    const s = mk()
    await s.set('stages', 'main', stage('main'))
    await s.delete('stages', 'main')
    await s.delete('stages', 'main')
    expect(s.peek('stages')).toEqual({})
  })

  it('setMany writes all records and rejects docs without an id', async () => {
    const s = mk()
    await s.setMany('stages', [stage('a'), stage('b')])
    expect(Object.keys(s.peek('stages'))).toEqual(['a', 'b'])
    await expect(s.setMany('stages', [stage('c'), stage('')])).rejects.toBeInstanceOf(StoreError)
    expect(s.peek('stages').c).toBeUndefined()
  })

  it('keeps the collection reference until something changes', async () => {
    const s = mk()
    const a = s.peek('stages')
    expect(s.peek('stages')).toBe(a)
    await s.set('stages', 'main', stage('main'))
    expect(s.peek('stages')).not.toBe(a)
  })
})

describe('LocalStore subscriptions', () => {
  it('sends current docs first, then each change, until unsubscribed', async () => {
    const s = mk()
    await s.set('stages', 'a', stage('a'))
    const cb = vi.fn()
    const off = s.subscribe('stages', cb)
    expect(cb).toHaveBeenLastCalledWith({ docs: { a: stage('a') }, changes: [{ type: 'added', id: 'a', doc: stage('a') }] })

    await s.set('stages', 'b', stage('b'))
    expect(cb.mock.lastCall![0].changes).toEqual([{ type: 'added', id: 'b', doc: stage('b') }])
    await s.update('stages', 'a', { name: 'A' })
    expect(cb.mock.lastCall![0].changes[0]).toMatchObject({ type: 'modified', id: 'a', doc: { name: 'A' } })
    await s.delete('stages', 'b')
    expect(cb.mock.lastCall![0].changes).toEqual([{ type: 'removed', id: 'b' }])
    expect(Object.keys(cb.mock.lastCall![0].docs)).toEqual(['a'])

    off()
    await s.set('stages', 'c', stage('c'))
    expect(cb).toHaveBeenCalledTimes(4)
  })

  it('only notifies subscribers of the changed collection', async () => {
    const s = mk()
    const cb = vi.fn()
    s.subscribe('artists', cb)
    await s.set('stages', 'a', stage('a'))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('config docs can be read, subscribed to and replaced', async () => {
    const s = mk()
    const cb = vi.fn()
    s.subscribeConfig('event', cb)
    expect(cb).toHaveBeenLastCalledWith(cfg)
    await s.setConfig('event', { ...cfg, name: 'Renamed' })
    expect(cb.mock.lastCall![0].name).toBe('Renamed')
    expect(s.peekConfig('event')?.name).toBe('Renamed')
  })
})

describe('LocalStore audit and persistence', () => {
  it('logs writes with the actor, newest first', async () => {
    const s = mk()
    s.setActor('u1')
    await s.set('stages', 'a', stage('a'))
    await s.update('stages', 'a', { name: 'A' })
    const log = await s.audit()
    expect(log.map(e => [e.op, e.col, e.id, e.actor])).toEqual([['update', 'stages', 'a', 'u1'], ['set', 'stages', 'a', 'u1']])
    expect(log[0].patch).toEqual({ name: 'A' })
  })

  it('saves to storage after the debounce and loads it back', async () => {
    vi.useFakeTimers()
    const storage = new MemStorage()
    const s = mk(storage)
    await s.set('stages', 'a', stage('a'))
    expect(storage.getItem('k')).toBeNull()
    vi.advanceTimersByTime(400)
    expect(JSON.parse(storage.getItem('k')!).col.stages.a.name).toBe('a')
    expect(mk(storage).peek('stages').a).toEqual(stage('a'))
  })

  it('ignores saved data with another schema version', () => {
    const storage = new MemStorage()
    storage.setItem('k', JSON.stringify({ cfg: { ...cfg, schema: 1 }, roles: null, col: { stages: { old: stage('old') } } }))
    expect(mk(storage).peek('stages')).toEqual({})
  })

  it('reset replaces everything and reports the differences', async () => {
    const s = mk()
    await s.set('stages', 'a', stage('a'))
    const cb = vi.fn()
    s.subscribe('stages', cb)
    s.reset({ ...blank(), col: { ...emptyCollections(), stages: { b: stage('b') } } })
    expect(cb.mock.lastCall![0].changes).toEqual([{ type: 'added', id: 'b', doc: stage('b') }, { type: 'removed', id: 'a' }])
  })
})
