import { describe, expect, it } from 'vitest'
import { createAccess } from '../access/access'
import { emptySnapshot } from '../data/localStore'
import { buildSample } from '../data/sample'
import { EVENT_TYPES } from '../domain/constants'
import { homePath, hqNav, hqPath, resolvePage, stageNav, stagePath } from './nav'

const snap = buildSample(Date.UTC(2026, 6, 2, 18, 0))
const T = EVENT_TYPES.festival.terms
const as = (uid: string) => createAccess(snap, { uid })
const views = (items: { view: string }[]) => items.map(i => i.view)

describe('HQ nav', () => {
  it('shows the admin every section', () => {
    expect(views(hqNav(as('demo-admin'), T))).toEqual(['overview', 'schedule', 'artists', 'personnel', 'clocks', 'messages', 'accommodation', 'riders', 'admin'])
  })

  it('leaves out what a role cannot see', () => {
    // Hospitality: no admin; riders through hospitality riders only.
    expect(views(hqNav(as('demo-hosp'), T))).toEqual(['overview', 'schedule', 'artists', 'personnel', 'clocks', 'messages', 'accommodation', 'riders'])
  })

  it('hides switched-off modules', () => {
    const s2 = structuredClone(snap)
    s2.cfg!.modules = { accommodation: false, riders: false }
    expect(views(hqNav(createAccess(s2, { uid: 'demo-admin' }), T))).not.toContain('accommodation')
    expect(views(hqNav(createAccess(s2, { uid: 'demo-admin' }), T))).not.toContain('riders')
  })

  it("uses the event's vocabulary", () => {
    const conf = EVENT_TYPES.conference.terms
    expect(hqNav(as('demo-admin'), conf).find(i => i.view === 'artists')!.label).toBe('Speakers')
    expect(stageNav(as('demo-admin'), 'main', conf).find(i => i.view === 'display')!.label).toBe('Room display')
  })
})

describe('stage nav', () => {
  it('gives a stage manager their stage, including setup', () => {
    expect(views(stageNav(as('demo-sm-main'), 'main', T))).toEqual(['today', 'runsheet', 'artists', 'personnel', 'clocks', 'messages', 'riders', 'display', 'setup'])
    expect(stageNav(as('demo-sm-main'), 'tent', T)).toEqual([])
  })

  it('gives crew everything but setup', () => {
    expect(views(stageNav(as('demo-crew-main-3'), 'main', T))).toEqual(['today', 'runsheet', 'artists', 'personnel', 'clocks', 'messages', 'riders', 'display'])
  })

  it('keeps stage setup from festival roles below admin', () => {
    expect(views(stageNav(as('demo-pm'), 'main', T))).not.toContain('setup')
    expect(views(stageNav(as('demo-admin'), 'main', T))).toContain('setup')
  })
})

describe('home and page checks', () => {
  it('sends HQ roles to HQ and stage-only people to their stage', () => {
    expect(homePath(as('demo-pm'))).toBe('/hq/overview')
    expect(homePath(as('demo-sm-tent'))).toBe('/s/tent/today')
    expect(homePath(as('demo-crew-main-6'))).toBe('/s/main/today')
  })

  it('builds paths', () => {
    expect(hqPath()).toBe('/hq/overview')
    expect(hqPath('artist', 'a 1')).toBe('/hq/artist/a%201')
    expect(stagePath('main')).toBe('/s/main/today')
  })

  it('asks for setup when there is no event', () => {
    expect(resolvePage(as('demo-admin'), emptySnapshot(), 'hq', 'overview')).toEqual({ kind: 'setup' })
  })

  it('refuses pages outside the nav, even by URL', () => {
    expect(resolvePage(as('demo-sm-main'), snap, 'hq', 'overview').kind).toBe('denied')
    expect(resolvePage(as('demo-sm-main'), snap, 'tent', 'today')).toEqual({ kind: 'denied', message: "You don't have access to this stage." })
    expect(resolvePage(as('demo-crew-main-3'), snap, 'main', 'setup').kind).toBe('denied')
    expect(resolvePage(as('demo-admin'), snap, 'hq', 'nonsense').kind).toBe('denied')
    expect(resolvePage(as('demo-admin'), snap, 'gone', 'today')).toEqual({ kind: 'denied', message: 'This stage no longer exists.' })
  })

  it('allows pages in the nav', () => {
    const res = resolvePage(as('demo-sm-main'), snap, 'main', 'setup')
    expect(res).toMatchObject({ kind: 'ok', item: { view: 'setup', label: 'Stage setup' } })
  })

  it("checks an artist page against that artist's stage", () => {
    const mainArtist = Object.values(snap.col.artists).find(a => a.stage === 'main')!
    const tentArtist = Object.values(snap.col.artists).find(a => a.stage === 'tent')!
    expect(resolvePage(as('demo-sm-main'), snap, 'main', 'artist', mainArtist.id).kind).toBe('ok')
    expect(resolvePage(as('demo-sm-main'), snap, 'main', 'artist', tentArtist.id).kind).toBe('denied')
    expect(resolvePage(as('demo-admin'), snap, 'hq', 'artist', 'nope')).toEqual({ kind: 'denied', message: 'This artist no longer exists.' })
  })
})
