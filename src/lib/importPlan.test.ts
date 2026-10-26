import { describe, expect, it } from 'vitest'
import { LocalStore } from '../data/localStore'
import { buildSample } from '../data/sample'
import type { ImportResult } from '../shared/importSchema'
import { applyImport, importable, planImport, type EventState } from './importPlan'
import { festDay, fromLocal } from './time'

const T0 = Date.parse('2026-06-12T10:00:00Z')

function setup() {
  const store = new LocalStore({ initial: () => buildSample(T0), storageKey: null })
  const state = (): EventState => ({
    cfg: store.peekConfig('event')!, stages: store.peek('stages'), artists: store.peek('artists'), ros: store.peek('ros'),
    people: store.peek('people'), hotels: store.peek('hotels'), bookings: store.peek('bookings'),
  })
  return { store, state, day: festDay(T0, 'Europe/Oslo') }
}

const empty = (): ImportResult => ({ stages: [], artists: [], items: [], people: [], hotels: [], bookings: [], leftover: '' })

describe('import plan', () => {
  it('adds a new artist on an existing stage with a day sheet that runs past midnight', async () => {
    const { store, state, day } = setup()
    const r = empty()
    r.artists.push({
      name: 'Kaizers Orchestra', stage: 'main stage', genre: 'Rock', party: 12, notes: null,
      contacts: [{ role: 'Tour manager', name: 'Ola Nordmann', phone: '+47 900 00 000', email: null }],
      shows: [{ date: day, start: '23:30', end: '00:45', soundcheck: '14:00' }],
    })
    r.items.push({ stage: null, artist: 'Kaizers Orchestra', kind: 'arrival', title: 'Arrival', date: day, start: '12:15', end: null })
    const plan = planImport(r, state(), null)
    expect(plan.rows.map(x => [x.group, x.isNew])).toEqual([['artists', true], ['shows', true]])

    await applyImport(store, state().cfg, importable(plan, new Set(plan.rows.map(x => x.key))))
    const a = Object.values(store.peek('artists')).find(x => x.name === 'Kaizers Orchestra')!
    expect(a.stage).toBe('main')
    expect(a.contacts[0].name).toBe('Ola Nordmann')
    const items = Object.values(store.peek('ros')).filter(x => x.artist === a.id)
    expect(items).toHaveLength(9)
    const show = items.find(x => x.kind === 'show')!
    expect(show.start).toBe(fromLocal(`${day}T23:30`, 'Europe/Oslo'))
    expect(show.end - show.start).toBe(75 * 60_000)
    // The text's arrival time replaces the template's.
    expect(items.find(x => x.kind === 'arrival')!.start).toBe(fromLocal(`${day}T12:15`, 'Europe/Oslo'))
  })

  it('gives an existing artist only new contacts, and replaces their day sheet for that day', () => {
    const { state, day } = setup()
    const s = state()
    const ex = Object.values(s.artists).find(a => a.contacts.length && Object.values(s.ros).some(i => i.artist === a.id && festDay(i.start, 'Europe/Oslo') === day))!
    const r = empty()
    r.artists.push({
      name: ex.name.toUpperCase(), stage: null, genre: null, party: null, notes: null,
      contacts: [{ role: 'Tour manager', name: ex.contacts[0].name, phone: null, email: null }, { role: 'Driver', name: 'Kari Kjører', phone: '+47 911 11 111', email: null }],
      shows: [{ date: day, start: '20:00', end: '21:00', soundcheck: null }],
    })
    const plan = planImport(r, s, null)
    const upd = plan.rows.find(x => x.group === 'artists')!
    expect(upd.isNew).toBe(false)
    expect(upd.writes[0]).toMatchObject({ op: 'update', patch: { contacts: [...ex.contacts, expect.objectContaining({ name: 'Kari Kjører' })] } })
    const show = plan.rows.find(x => x.group === 'shows')!
    expect(show.isNew).toBe(false)
    expect(show.writes.filter(w => w.op === 'delete').length).toBeGreaterThan(0)
  })

  it('creates a stage an artist names, and blocks the artist if the stage is unticked', () => {
    const { state, day } = setup()
    const r = empty()
    r.artists.push({ name: 'New Act', stage: 'Beach Stage', genre: null, party: null, notes: null, contacts: [], shows: [{ date: day, start: '18:00', end: null, soundcheck: null }] })
    const plan = planImport(r, state(), null)
    expect(plan.rows.map(x => x.group)).toEqual(['stages', 'artists', 'shows'])
    expect(plan.rows[2].warn).toMatch(/60 minutes/)
    const all = new Set(plan.rows.map(x => x.key))
    expect(importable(plan, all)).toHaveLength(3)
    all.delete('stage:beach stage')
    expect(importable(plan, all)).toHaveLength(0)
  })

  it('matches people by email, fills only what is missing, and adds unknown departments', async () => {
    const { store, state } = setup()
    const s = state()
    const p = Object.values(s.people)[0]
    const r = empty()
    r.people.push({ name: 'Someone Else', title: 'Boss', company: null, dept: null, phone: '+47 1', email: p.email!.toUpperCase(), accred: null, stages: [] })
    r.people.push({ name: 'Nina Lyd', title: 'A2', company: 'Lydhuset', dept: 'Sound', phone: null, email: 'nina@lyd.no', accred: 'aaa', stages: ['The Tent'] })
    const plan = planImport(r, s, null)
    // The first one already has a title and phone: nothing to update.
    expect(plan.rows).toHaveLength(1)
    await applyImport(store, s.cfg, plan.rows)
    const cfg = store.peekConfig('event')!
    const nina = Object.values(store.peek('people')).find(x => x.email === 'nina@lyd.no')!
    expect(nina.accred).toBe('AAA')
    expect(nina.stages).toEqual(['tent'])
    expect(cfg.depts.find(d => d.id === nina.dept)?.name).toBe(s.cfg.depts.find(d => d.name.toLowerCase() === 'sound')?.name ?? 'Sound')
  })

  it('books rooms in a new hotel and switches Accommodation on', async () => {
    const { store, state, day } = setup()
    await store.setConfig('event', { ...store.peekConfig('event')!, modules: { ...store.peekConfig('event')!.modules, accommodation: false } })
    const r = empty()
    r.bookings.push({ hotel: 'Thon Hotel Oslo', artist: null, guest: 'Press team', checkIn: day, checkOut: day, rooms: 2 })
    r.bookings.push({ hotel: 'Fjordhotellet', artist: null, guest: 'Agent', checkIn: day, checkOut: day, rooms: 1 })
    const plan = planImport(r, state(), null)
    expect(plan.rows.map(x => x.group)).toEqual(['hotels', 'bookings', 'bookings'])
    await applyImport(store, state().cfg, importable(plan, new Set(plan.rows.map(x => x.key))))
    expect(store.peekConfig('event')!.modules.accommodation).toBe(true)
    const thon = Object.values(store.peek('hotels')).find(h => h.name === 'Thon Hotel Oslo')!
    expect(Object.values(store.peek('bookings')).filter(b => b.hotel === thon.id || b.guest === 'Agent')).toHaveLength(2)
  })

  it('puts items without a stage on the chosen default stage', () => {
    const { state, day } = setup()
    const r = empty()
    r.items.push({ stage: null, artist: null, kind: 'doors', title: 'Doors', date: day, start: '12:00', end: null })
    const plan = planImport(r, state(), 'fjord')
    expect(plan.unplaced).toBe(1)
    expect(plan.rows[0].writes[0]).toMatchObject({ op: 'set', doc: { stage: 'fjord', kind: 'doors' } })
  })
})
