import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import type { Person } from '../types/model'
import { artistsFor, nextActivity, removeContact, upsertContact } from './artists'
import { MIN } from './constants'
import { filterPeople, parseCrewList, personUser, stageLead } from './people'
import { relTime } from './time'

const NOW = Date.UTC(2026, 6, 2, 18, 0)
const snap = buildSample(NOW)
const depts = snap.cfg!.depts

describe('parseCrewList', () => {
  it('reads comma, tab and semicolon separated lines', () => {
    const rows = parseCrewList([
      'Kari Nordmann, Stagehand, +47 900 00 000, kari@example.com',
      'Ola Hansen\tRigger\t+47 911 11 111',
      'Siri Lie; siri@rig.example; Lead rigger; Rig AS',
      '',
      '   ',
      'Just A Name',
    ].join('\n'))
    expect(rows).toEqual([
      { name: 'Kari Nordmann', title: 'Stagehand', company: '', phone: '+47 900 00 000', email: 'kari@example.com' },
      { name: 'Ola Hansen', title: 'Rigger', company: '', phone: '+47 911 11 111', email: '' },
      { name: 'Siri Lie', title: 'Lead rigger', company: 'Rig AS', phone: '', email: 'siri@rig.example' },
      { name: 'Just A Name', title: '', company: '', phone: '', email: '' },
    ])
  })

  it("doesn't mistake a short number or a job title for a phone", () => {
    expect(parseCrewList('Eva, Crew 2, 12345')[0]).toMatchObject({ title: 'Crew 2', company: '12345', phone: '' })
  })
})

describe('filterPeople', () => {
  it("lists a stage's crew, key contacts first", () => {
    const list = filterPeople(snap.col.people, depts, { stage: 'main' })
    expect(list).toHaveLength(10)
    const leads = list.filter(p => p.lead).length
    expect(list.slice(0, leads).every(p => p.lead)).toBe(true)
  })

  it('filters by department and searches across fields', () => {
    expect(filterPeople(snap.col.people, depts, { dept: 'audio', stage: 'tent' }).map(p => p.title).sort()).toEqual(['Audio crew chief', 'Monitor tech'])
    const someone = Object.values(snap.col.people)[5] as Person
    expect(filterPeople(snap.col.people, depts, { q: someone.phone!.slice(-6) }).map(p => p.id)).toContain(someone.id)
    expect(filterPeople(snap.col.people, depts, { q: 'nordic sound' }).every(p => p.company === 'Nordic Sound AS')).toBe(true)
  })

  it("finds a person's app user and a stage's lead", () => {
    const pid = snap.col.members['demo-sm-main'].person!
    expect(personUser(snap, pid)).toBe('demo-sm-main')
    expect(stageLead(snap, 'main')?.id).toBe(pid)
  })
})

describe('artists', () => {
  it('lists a stage, or every visible stage in HQ, with search', () => {
    expect(artistsFor(snap.col.artists, 'main', () => true)).toHaveLength(9)
    expect(artistsFor(snap.col.artists, null, sid => sid === 'tent').every(a => a.stage === 'tent')).toBe(true)
    const first = Object.values(snap.col.artists)[0]
    expect(artistsFor(snap.col.artists, null, () => true, first.name.slice(0, 5).toUpperCase()).map(a => a.id)).toContain(first.id)
  })

  it("finds an artist's next activity", () => {
    const a = Object.values(snap.col.artists).find(x => x.status === 'travelling')!
    expect(nextActivity(snap.col.ros, a.id, NOW)?.kind).toBe('arrival')
  })

  it('adds, replaces and removes contacts', () => {
    const c1 = { id: 'c1', role: 'Tour manager', name: 'Eva' }
    const list = upsertContact([], c1)
    expect(upsertContact(list, { ...c1, name: 'Eva Moe' })).toEqual([{ ...c1, name: 'Eva Moe' }])
    expect(upsertContact(list, { id: 'c2', role: 'Driver', name: 'Ola' })).toHaveLength(2)
    expect(removeContact(list, 'c1')).toEqual([])
  })
})

describe('relTime', () => {
  it('describes time relative to now', () => {
    expect(relTime(NOW + 20 * MIN, NOW)).toBe('in 20 min')
    expect(relTime(NOW - 90 * MIN, NOW)).toBe('1.5 h ago')
    expect(relTime(NOW + 30_000, NOW)).toBe('just now')
    expect(relTime(NOW + 72 * 60 * MIN, NOW)).toBe('in 3 days')
  })
})
