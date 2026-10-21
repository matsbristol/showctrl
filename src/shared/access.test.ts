import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import type { Msg } from '../types/model'
import { createAccess, type Preview } from './access'
import { canWrite, canWriteConfig, type WriteRequest } from './writeRules'
import { hqViews, homePath, stageViews } from './views'

const d = buildSample(Date.UTC(2026, 6, 10, 18))
const { col } = d
const as = (me: string | null, extra: { preview?: Preview; isOwner?: boolean; readOnly?: boolean } = {}) =>
  createAccess({ me, roles: d.roles, members: col.members, stageteam: col.stageteam, stages: col.stages, ...extra })
const ctx = { artistStage: (id: string) => col.artists[id]?.stage }
const w = (a: ReturnType<typeof as>, req: WriteRequest) => canWrite(a, req, ctx).ok

const mainArtist = Object.values(col.artists).find(x => x.stage === 'main')!
const tentArtist = Object.values(col.artists).find(x => x.stage === 'tent')!
const mainShow = Object.values(col.ros).find(r => r.stage === 'main' && r.kind === 'show')!

describe('createAccess levels', () => {
  it('gives admins edit on everything', () => {
    const a = as('demo-admin')
    expect(a.role()).toBe('admin')
    expect(a.lv('schedule', 'main')).toBe(2)
    expect(a.lv('setup', 'main')).toBe(2)
    expect(a.hqVisible()).toBe(true)
  })

  it('treats the workspace owner as admin whatever their member role', () => {
    expect(as('stranger', { isOwner: true }).role()).toBe('admin')
  })

  it('gives a stage manager edit on their stage only', () => {
    const a = as('demo-sm-main')
    expect(a.role()).toBe('none')
    expect(a.stageRole('main')).toBe('manager')
    expect(a.lv('schedule', 'main')).toBe(2)
    expect(a.lv('accommodation', 'main')).toBe(1)
    expect(a.lv('schedule', 'tent')).toBe(0)
    expect(a.hqVisible()).toBe(false)
    expect(a.visibleStages().map(s => s.id)).toEqual(['main'])
    expect(a.canSeeStage('tent')).toBe(false)
  })

  it('gives stage crew view rights and message sending', () => {
    const a = as('demo-crew-main-3')
    expect(a.stageRole('main')).toBe('crew')
    expect(a.lv('schedule', 'main')).toBe(1)
    expect(a.canW('messages', 'main')).toBe(true)
    expect(a.canW('schedule', 'main')).toBe(false)
    expect(a.lv('riders_hosp', 'main')).toBe(0)
  })

  it('takes the higher of festival role and stage role', () => {
    const a = as('demo-hosp') // Hospitality: riders_tech 0, schedule 1
    expect(a.lv('riders_tech', 'main')).toBe(0)
    expect(a.lv('riders_hosp', 'main')).toBe(2)
    expect(a.visibleStages()).toHaveLength(5)
  })

  it('shows artist contacts to contact roles, admins and that stage’s manager', () => {
    expect(as('demo-al').artistContacts(mainArtist)).toBe(true)
    expect(as('demo-hosp').artistContacts(mainArtist)).toBe(false)
    expect(as('demo-sm-main').artistContacts(mainArtist)).toBe(true)
    expect(as('demo-sm-main').artistContacts(tentArtist)).toBe(false)
  })

  it('blocks all writes when read-only', () => {
    expect(as('demo-admin', { readOnly: true }).canW('schedule', 'main')).toBe(false)
  })

  it('treats unknown users as having no access', () => {
    const a = as('nobody')
    expect(a.hasNoAccess()).toBe(true)
    expect(a.lv('show')).toBe(0)
  })
})

describe('preview', () => {
  it('previews a festival role without stage roles', () => {
    const a = as('demo-sm-main', { preview: { type: 'role', role: 'hosp' } })
    expect(a.role()).toBe('hosp')
    expect(a.stageRole('main')).toBeNull()
  })

  it('previews a stage role on one stage', () => {
    const a = as('demo-admin', { preview: { type: 'stage', level: 'crew', sid: 'tent' } })
    expect(a.role()).toBe('none')
    expect(a.stageRole('tent')).toBe('crew')
    expect(a.lv('schedule', 'main')).toBe(0)
  })
})

describe('messages', () => {
  const msg = (to: Msg['to'], from = 'demo-pm'): Msg => ({ id: 'x', from, to, text: '', pri: 'normal', at: 0, acks: {} })

  it('shows department messages to that department', () => {
    expect(as('demo-al').canSeeMsg(msg({ t: 'dept', id: 'al' }), true)).toBe(true)
    expect(as('demo-hosp').canSeeMsg(msg({ t: 'dept', id: 'al' }), true)).toBe(false)
  })

  it('shows stage messages to the stage team, and to messages-viewers in the inbox only', () => {
    expect(as('demo-crew-main-3').canSeeMsg(msg({ t: 'stage', id: 'main' }), true)).toBe(true)
    expect(as('demo-hosp').canSeeMsg(msg({ t: 'stage', id: 'main' }), true)).toBe(false)
    expect(as('demo-hosp').canSeeMsg(msg({ t: 'stage', id: 'main' }))).toBe(true)
  })

  it('shows direct messages to the recipient and sender only', () => {
    const m = msg({ t: 'user', id: 'demo-al' }, 'demo-hosp')
    expect(as('demo-al').canSeeMsg(m)).toBe(true)
    expect(as('demo-hosp').canSeeMsg(m)).toBe(true)
    expect(as('demo-sm-main').canSeeMsg(m)).toBe(false)
  })
})

describe('views', () => {
  it('lists HQ pages by festival role', () => {
    expect(hqViews(as('demo-admin'), d.cfg)).toContain('admin')
    expect(hqViews(as('demo-hosp'), d.cfg)).toEqual([
      'overview', 'schedule', 'screens', 'clocks', 'messages', 'artists', 'summary', 'risk', 'riders',
      'trucks', 'transport', 'accommodation', 'facilities', 'personnel', 'documents',
    ]) // no input lists, plots or risers: Hospitality has no Technical rights
    expect(hqViews(as('demo-sm-main'), d.cfg)).toEqual([])
  })

  it('hides switched-off modules', () => {
    expect(hqViews(as('demo-admin'), { ...d.cfg!, modules: { riders: false } })).not.toContain('riders')
  })

  it('lists stage pages by stage role', () => {
    expect(stageViews(as('demo-sm-main'), d.cfg, 'main')).toContain('setup')
    expect(stageViews(as('demo-crew-main-3'), d.cfg, 'main')).not.toContain('setup')
    expect(stageViews(as('demo-sm-main'), d.cfg, 'tent')).toEqual([])
  })

  it('sends stage-only users to their stage', () => {
    expect(homePath(as('demo-admin'))).toBe('/hq/overview')
    expect(homePath(as('demo-sm-tent'))).toBe('/s/tent/today')
  })
})

describe('canWrite', () => {
  it('lets a stage manager edit their own run sheet, not another stage’s', () => {
    expect(w(as('demo-sm-main'), { col: 'ros', id: mainShow.id, prev: mainShow, next: { ...mainShow, delay: 5 } })).toBe(true)
    expect(w(as('demo-sm-tent'), { col: 'ros', id: mainShow.id, prev: mainShow, next: { ...mainShow, delay: 5 } })).toBe(false)
    expect(w(as('demo-crew-main-3'), { col: 'ros', id: mainShow.id, prev: mainShow, next: { ...mainShow, delay: 5 } })).toBe(false)
  })

  it('needs edit rights on both stages to move a record', () => {
    expect(w(as('demo-sm-main'), { col: 'ros', id: mainShow.id, prev: mainShow, next: { ...mainShow, stage: 'tent' } })).toBe(false)
    expect(w(as('demo-pm'), { col: 'ros', id: mainShow.id, prev: mainShow, next: { ...mainShow, stage: 'tent' } })).toBe(true)
  })

  it('keeps members and config to admins', () => {
    const m = col.members['demo-hosp']
    expect(w(as('demo-sm-main'), { col: 'members', id: 'demo-hosp', prev: m, next: { ...m, role: 'admin' } })).toBe(false)
    expect(w(as('demo-admin'), { col: 'members', id: 'demo-hosp', prev: m, next: { ...m, role: 'pm' } })).toBe(true)
    expect(canWriteConfig(as('demo-pm'), 'roles').ok).toBe(false)
    expect(canWriteConfig(as('demo-admin'), 'event').ok).toBe(true)
  })

  it('lets a stage manager edit the stage and its team, but not create stages', () => {
    const st = col.stages.main
    expect(w(as('demo-sm-main'), { col: 'stages', id: 'main', prev: st, next: { ...st, radio: 'Ch 9' } })).toBe(true)
    expect(w(as('demo-sm-main'), { col: 'stages', id: 'new', prev: null, next: { ...st, id: 'new' } })).toBe(false)
    const team = col.stageteam.main
    expect(w(as('demo-sm-main'), { col: 'stageteam', id: 'main', prev: team, next: { ...team, crew: {} } })).toBe(true)
    expect(w(as('demo-crew-main-3'), { col: 'stageteam', id: 'main', prev: team, next: { ...team, crew: {} } })).toBe(false)
  })

  it('only allows acknowledging a message, not editing it', () => {
    const m: Msg = { id: 'm', from: 'demo-pm', to: { t: 'stage', id: 'main' }, text: 'hi', pri: 'normal', at: 1, acks: { 'demo-pm': 1 } }
    const a = as('demo-crew-main-3')
    expect(w(a, { col: 'msgs', id: 'm', prev: m, next: { ...m, acks: { ...m.acks, 'demo-crew-main-3': 2 } } })).toBe(true)
    expect(w(a, { col: 'msgs', id: 'm', prev: m, next: { ...m, text: 'changed', acks: { ...m.acks, 'demo-crew-main-3': 2 } } })).toBe(false)
    expect(w(a, { col: 'msgs', id: 'm', prev: m, next: { ...m, acks: {} } })).toBe(false)
    expect(w(as('demo-crew-tent-3'), { col: 'msgs', id: 'm', prev: m, next: { ...m, acks: { ...m.acks, 'demo-crew-tent-3': 2 } } })).toBe(false)
  })

  it('checks the sender and recipient of a new message', () => {
    const m: Msg = { id: 'n', from: 'demo-crew-main-3', to: { t: 'stage', id: 'main' }, text: 'x', pri: 'normal', at: 1, acks: {} }
    expect(w(as('demo-crew-main-3'), { col: 'msgs', id: 'n', prev: null, next: m })).toBe(true)
    expect(w(as('demo-crew-main-3'), { col: 'msgs', id: 'n', prev: null, next: { ...m, to: { t: 'stage', id: 'tent' } } })).toBe(false)
    expect(w(as('demo-crew-main-3'), { col: 'msgs', id: 'n', prev: null, next: { ...m, from: 'demo-pm' } })).toBe(false)
  })

  it('checks riders against the artist’s stage', () => {
    const r = { id: `${mainArtist.id}_tech`, artist: mainArtist.id, kind: 'tech' as const, items: {}, updated: 0 }
    expect(w(as('demo-sm-main'), { col: 'riders', id: r.id, prev: null, next: r })).toBe(true)
    expect(w(as('demo-sm-tent'), { col: 'riders', id: r.id, prev: null, next: r })).toBe(false)
    expect(w(as('demo-sm-main'), { col: 'riders', id: 'wrong', prev: null, next: { ...r, id: 'wrong' } })).toBe(false)
  })

  it('lets a stage manager edit people on their stage without touching other stages', () => {
    const p = Object.values(col.people).find(x => x.stages.includes('main'))!
    const a = as('demo-sm-main')
    expect(w(a, { col: 'people', id: p.id, prev: p, next: { ...p, phone: '1' } })).toBe(true)
    expect(w(a, { col: 'people', id: p.id, prev: p, next: { ...p, stages: ['main', 'tent'] } })).toBe(false)
    const hq = Object.values(col.people).find(x => !x.stages.length)!
    expect(w(a, { col: 'people', id: hq.id, prev: hq, next: { ...hq, phone: '1' } })).toBe(false)
  })

  it('lets anyone ask for access for themselves only', () => {
    const r = { id: 'newbie', at: 1, note: '', stage: 'main' }
    expect(w(as('newbie'), { col: 'requests', id: 'newbie', prev: null, next: r })).toBe(true)
    expect(w(as('newbie'), { col: 'requests', id: 'other', prev: null, next: { ...r, id: 'other' } })).toBe(false)
    expect(w(as('demo-sm-main'), { col: 'requests', id: 'newbie', prev: r, next: null })).toBe(true)
  })

  it('lets users write only their own prefs', () => {
    expect(w(as('demo-crew-main-3'), { col: 'prefs', id: 'demo-crew-main-3', prev: null, next: { id: 'demo-crew-main-3', lastRead: 1 } })).toBe(true)
    expect(w(as('demo-crew-main-3'), { col: 'prefs', id: 'demo-pm', prev: null, next: { id: 'demo-pm', lastRead: 1 } })).toBe(false)
    expect(w(as('demo-admin'), { col: 'prefs', id: 'demo-pm', prev: null, next: { id: 'demo-pm', lastRead: 1 } })).toBe(false)
  })

  it('rejects a body whose id does not match', () => {
    expect(w(as('demo-admin'), { col: 'hotels', id: 'h1', prev: null, next: { ...col.hotels.h2 } })).toBe(false)
  })
})
