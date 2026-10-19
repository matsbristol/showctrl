import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import { createAccess, stageRoleOf, type Viewer } from './access'

const snap = buildSample(Date.UTC(2026, 6, 2, 18, 0))
const as = (uid: string | null, extra: Partial<Viewer> = {}) => createAccess(snap, { uid, ...extra })
const ids = (stages: { id: string }[]) => stages.map(s => s.id)

const mainArtist = Object.values(snap.col.artists).find(a => a.stage === 'main')!
const tentArtist = Object.values(snap.col.artists).find(a => a.stage === 'tent')!

describe('festival roles', () => {
  it('gives the festival admin edit on everything', () => {
    const a = as('demo-admin')
    expect(a.isAdmin).toBe(true)
    expect(a.lv('admin')).toBe(2)
    expect(a.lv('setup', 'tent')).toBe(2)
    expect(a.canW('schedule', 'main')).toBe(true)
    expect(a.hqVisible()).toBe(true)
    expect(a.canSeeContacts(tentArtist)).toBe(true)
    expect(ids(a.visibleStages())).toEqual(['main', 'fjord', 'tent', 'club', 'forest'])
  })

  it('makes the workspace owner admin even without a member record', () => {
    expect(as('someone-new', { isOwner: true }).role).toBe('admin')
  })

  it('gives artist liaison festival-wide artist edit and contacts, but view-only schedule', () => {
    const a = as('demo-al')
    expect(a.lv('artists', 'tent')).toBe(2)
    expect(a.lv('schedule', 'tent')).toBe(1)
    expect(a.canW('schedule', 'tent')).toBe(false)
    expect(a.lv('admin')).toBe(0)
    expect(a.canSeeContacts(tentArtist)).toBe(true)
    expect(a.canSeeStage('forest')).toBe(true)
  })

  it('hides contacts from hospitality but lets them edit hospitality riders', () => {
    const a = as('demo-hosp')
    expect(a.canSeeContacts(mainArtist)).toBe(false)
    expect(a.canW('riders_hosp')).toBe(true)
    expect(a.lv('riders_tech')).toBe(0)
  })

  it('treats unknown roles, missing members and signed-out viewers as stage access only', () => {
    const s2 = structuredClone(snap)
    s2.col.members.odd = { id: 'odd', role: 'deleted-role', stages: {}, depts: [] }
    expect(createAccess(s2, { uid: 'odd' }).roleDef.label).toBe('Stage access only')
    for (const a of [as('nobody'), as(null)]) {
      expect(a.role).toBe('none')
      expect(a.hqVisible()).toBe(false)
      expect(a.visibleStages()).toEqual([])
    }
  })
})

describe('stage roles', () => {
  it('lets a stage manager edit their own stage only', () => {
    const a = as('demo-sm-main')
    expect(a.stageRole('main')).toBe('manager')
    expect(a.canW('schedule', 'main')).toBe(true)
    expect(a.canW('artists', 'main')).toBe(true)
    expect(a.lv('setup', 'main')).toBe(2)
    expect(a.lv('accommodation', 'main')).toBe(1)
    expect(a.lv('schedule', 'tent')).toBe(0)
    expect(a.lv('schedule')).toBe(0)
    expect(a.lv('admin', 'main')).toBe(0)
    expect(a.hqVisible()).toBe(false)
    expect(ids(a.visibleStages())).toEqual(['main'])
    expect(a.canSeeStage('tent')).toBe(false)
  })

  it("shows contact details to that artist's stage manager only", () => {
    const a = as('demo-sm-main')
    expect(a.canSeeContacts(mainArtist)).toBe(true)
    expect(a.canSeeContacts(tentArtist)).toBe(false)
  })

  it('lets stage crew view their stage and send messages', () => {
    const a = as('demo-crew-main-3')
    expect(stageRoleOf(snap, 'demo-crew-main-3', 'main')).toBe('crew')
    expect(a.lv('schedule', 'main')).toBe(1)
    expect(a.canW('schedule', 'main')).toBe(false)
    expect(a.canW('messages', 'main')).toBe(true)
    expect(a.lv('riders_hosp', 'main')).toBe(0)
    expect(a.lv('setup', 'main')).toBe(0)
    expect(a.lv('schedule', 'fjord')).toBe(0)
    expect(a.anyLv('messages')).toBe(2)
    expect(a.canSeeContacts(mainArtist)).toBe(false)
  })

  it('takes the higher of festival role and stage role', () => {
    const s2 = structuredClone(snap)
    s2.col.members['demo-hosp'].stages = { tent: 'manager' }
    const a = createAccess(s2, { uid: 'demo-hosp' })
    expect(a.lv('schedule', 'tent')).toBe(2) // from stage manager
    expect(a.lv('schedule', 'main')).toBe(1) // from hospitality
    expect(a.lv('riders_hosp', 'main')).toBe(2) // from hospitality
    expect(a.canSeeContacts(tentArtist)).toBe(true)
  })
})

describe('write access and preview', () => {
  it('refuses all edits when the backend refuses writes', () => {
    const a = as('demo-admin', { canWrite: false })
    expect(a.lv('schedule', 'main')).toBe(2)
    expect(a.canW('schedule', 'main')).toBe(false)
  })

  it('previews a festival role without any stage roles', () => {
    const a = as('demo-sm-main', { preview: { type: 'role', role: 'hosp' } })
    expect(a.role).toBe('hosp')
    expect(a.stageRole('main')).toBeNull()
    expect(a.canW('schedule', 'main')).toBe(false)
  })

  it('previews one stage role with no festival role', () => {
    const a = as('demo-admin', { preview: { type: 'stage', sid: 'tent', level: 'crew' } })
    expect(a.role).toBe('none')
    expect(a.isAdmin).toBe(false)
    expect(a.stageRole('tent')).toBe('crew')
    expect(a.stageRole('main')).toBeNull()
    expect(a.canW('schedule', 'tent')).toBe(false)
    expect(ids(a.visibleStages())).toEqual(['tent'])
  })
})

describe('modules and departments', () => {
  it('treats modules as on unless switched off', () => {
    expect(as('demo-admin').moduleOn('riders')).toBe(true)
    const s2 = structuredClone(snap)
    s2.cfg!.modules = { riders: false }
    expect(createAccess(s2, { uid: 'demo-admin' }).moduleOn('riders')).toBe(false)
    expect(createAccess(s2, { uid: 'demo-admin' }).moduleOn('accommodation')).toBe(true)
  })

  it("returns the viewer's departments", () => {
    expect(as('demo-hosp').myDepts()).toEqual(['hosp'])
    expect(as(null).myDepts()).toEqual([])
  })
})
