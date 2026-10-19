import { describe, expect, it } from 'vitest'
import { createAccess } from '../access/access'
import { buildSample } from '../data/sample'
import type { Snapshot } from '../types/model'
import { accessChanges, addRole, blankEvent, pendingRequests, removeAccessChanges, removeDept, removeRole, roleLevel, setCrew, setManager, setRoleContacts, setRolePerm, templateForForm, templateFromForm, upsertDept, usersWithAccess, withType } from './admin'
import { DEFAULT_TPL } from './constants'

const snap = buildSample(Date.UTC(2026, 6, 2, 18, 0))

/** Applies access changes to a copy of the snapshot. */
function apply(s: Snapshot, uid: string, ch: ReturnType<typeof accessChanges>): Snapshot {
  const out = structuredClone(s)
  out.col.members[uid] = { id: uid, ...ch.member }
  for (const t of ch.teams) out.col.stageteam[t.id] = t
  if (ch.clearRequest) delete out.col.requests[uid]
  return out
}

describe('stage teams', () => {
  it('adds and removes crew', () => {
    const t = setCrew(undefined, 'main', 'u1', true)
    expect(t).toEqual({ id: 'main', crew: { u1: true } })
    expect(setCrew(setCrew(t, 'main', 'u2', true), 'main', 'u1', false)).toEqual({ id: 'main', crew: { u2: true } })
  })

  it('appoints and removes a manager, keeping their other stages', () => {
    const m = { id: 'x', role: 'none', depts: [], stages: { main: 'manager' as const } }
    expect(setManager(m, 'tent', true).stages).toEqual({ main: 'manager', tent: 'manager' })
    expect(setManager(m, 'main', false).stages).toEqual({})
    expect(setManager(undefined, 'tent', true)).toEqual({ role: 'none', depts: [], stages: { tent: 'manager' } })
  })
})

describe('access', () => {
  it('gives someone a festival role, a stage to manage and crew places', () => {
    const ch = accessChanges(snap, 'newbie', { role: 'tech', depts: ['audio'], managerOf: ['forest'], crewOn: ['main', 'tent'], name: 'Nora' })
    expect(ch.member).toEqual({ name: 'Nora', role: 'tech', person: null, depts: ['audio'], stages: { forest: 'manager' } })
    expect(ch.teams.map(t => t.id).sort()).toEqual(['main', 'tent'])
    const after = apply(snap, 'newbie', ch)
    const a = createAccess(after, { uid: 'newbie' })
    expect(a.stageRole('forest')).toBe('manager')
    expect(a.stageRole('main')).toBe('crew')
    expect(a.canW('schedule', 'forest')).toBe(true)
    // Technical production can edit technical riders everywhere.
    expect(a.canW('riders_tech', 'club')).toBe(true)
  })

  it('only touches stage teams that change, and keeps other crew', () => {
    const ch = accessChanges(snap, 'demo-crew-main-3', { role: 'none', depts: [], managerOf: [], crewOn: ['main'] })
    expect(ch.teams).toEqual([])
    const off = accessChanges(snap, 'demo-crew-main-3', { role: 'none', depts: [], managerOf: [], crewOn: [] })
    expect(off.teams).toEqual([{ id: 'main', crew: { 'demo-crew-main-6': true } }])
  })

  it('clears a handled request to join, and lists only unhandled ones', () => {
    const s2 = structuredClone(snap)
    s2.col.requests.wannabe = { id: 'wannabe', at: 1, note: 'Rigger', stage: 'main' }
    s2.col.requests['demo-sm-main'] = { id: 'demo-sm-main', at: 2, note: 'Already in' }
    expect(pendingRequests(s2).map(r => r.id)).toEqual(['wannabe'])
    expect(accessChanges(s2, 'wannabe', { role: 'none', depts: [], managerOf: [], crewOn: ['main'] }).clearRequest).toBe(true)
  })

  it('removes every crew place when access is removed', () => {
    const s2 = structuredClone(snap)
    s2.col.stageteam.tent.crew['demo-crew-main-3'] = true
    expect(removeAccessChanges(s2, 'demo-crew-main-3').map(t => [t.id, Object.keys(t.crew)])).toEqual([
      ['main', ['demo-crew-main-6']], ['tent', ['demo-crew-tent-3', 'demo-crew-tent-6']],
    ])
  })

  it('lists members and crew without member records', () => {
    const s2 = structuredClone(snap)
    s2.col.stageteam.club = { id: 'club', crew: { 'crew-only': true } }
    expect(usersWithAccess(s2)).toContain('crew-only')
    expect(usersWithAccess(s2)).toContain('demo-admin')
  })
})

describe('roles', () => {
  it('changes a level and contact access, but never on locked roles', () => {
    const r1 = setRolePerm(snap.roles, 'hosp', 'riders_tech', 1)
    expect(r1.hosp.perms.riders_tech).toBe(1)
    expect(setRoleContacts(r1, 'hosp', true).hosp.contacts).toBe(true)
    expect(setRolePerm(snap.roles, 'admin', 'show', 0)).toBe(snap.roles)
    expect(setRolePerm(snap.roles, 'none', 'show', 2)).toBe(snap.roles)
    expect(roleLevel(snap.roles, 'admin', 'riders_hosp')).toBe(2)
  })

  it('adds a role from a template and removes it only when unused', () => {
    const { roles, key } = addRole(snap.roles, 'Medical', 'site')
    expect(roles[key]).toMatchObject({ label: 'Medical', perms: snap.roles.site.perms, contacts: false })
    expect(roles[key].perms).not.toBe(snap.roles.site.perms)
    expect(removeRole(snap, roles, key)).not.toHaveProperty(key)
    const s2 = structuredClone(snap)
    s2.col.members.medic = { id: 'medic', role: key, stages: {}, depts: [] }
    expect(removeRole(s2, roles, key)).toBe('Move everyone off this role first.')
    expect(removeRole(snap, roles, 'pm')).toBe('Built-in roles can’t be removed.')
  })
})

describe('departments, template and event', () => {
  it('adds, renames and removes departments', () => {
    const d1 = upsertDept([], { name: 'Medical', tape: 'red' })
    expect(d1[0]).toMatchObject({ name: 'Medical', tape: 'red' })
    expect(upsertDept(d1, { id: d1[0].id, name: 'First aid', tape: 'red' })).toEqual([{ id: d1[0].id, name: 'First aid', tape: 'red' }])
    expect(removeDept(d1, d1[0].id)).toEqual([])
  })

  it('shows the template in positive minutes and stores before-show offsets negative', () => {
    const form = templateForForm({ changeover: 45 })
    expect(form).toMatchObject({ arrival: 240, access: 45, changeover: 45, departure: 150 })
    expect(templateFromForm({ ...form, arrival: '200' })).toEqual({ ...DEFAULT_TPL, arrival: -200, changeover: 45 })
    // A minus typed by mistake doesn't flip the meaning.
    expect(templateFromForm({ ...form, departure: '-90' }).departure).toBe(90)
  })

  it('starts a blank event and switches vocabulary with the type', () => {
    const e = blankEvent('2026-07-02')
    expect(e).toMatchObject({ schema: 2, start: '2026-07-02', end: '2026-07-04', type: 'festival' })
    expect(withType(e, 'conference').terms).toEqual({ performer: 'Speaker', performers: 'Speakers', stage: 'Room', stages: 'Rooms' })
  })
})
