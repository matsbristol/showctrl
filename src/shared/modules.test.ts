import { describe, expect, it } from 'vitest'
import { HQ_VIEWS, STAGE_VIEWS } from './views'
import { MODULES, moduleOfCollection, moduleOfView, moduleOn, permHidden } from './modules'
import { MODULE_IDS } from '../types/constants'

describe('modules', () => {
  it('describes every module id', () => {
    expect(Object.keys(MODULES).sort()).toEqual([...MODULE_IDS].sort())
  })

  it('uses each module’s default when the event never chose', () => {
    expect(moduleOn({ modules: {} }, 'riders')).toBe(true)
    expect(moduleOn({ modules: { riders: false } }, 'riders')).toBe(false)
    expect(moduleOn(null, 'messages')).toBe(true)
  })

  it('maps pages and collections to their module, leaving core pages alone', () => {
    expect(moduleOfView('accommodation', 'hq')).toBe('accommodation')
    expect(moduleOfView('display', 'stage')).toBe('display')
    expect(moduleOfView('runsheet', 'stage')).toBeNull()
    expect(moduleOfView('overview', 'hq')).toBeNull()
    expect(moduleOfCollection('msgs')).toBe('messages')
    expect(moduleOfCollection('people')).toBeNull() // names need people even without the Personnel module
    expect(moduleOfCollection('ros')).toBeNull()
  })

  it('only claims pages that exist', () => {
    for (const m of Object.values(MODULES)) {
      for (const v of m.hqViews) expect(HQ_VIEWS).toContain(v)
      for (const v of m.stageViews) expect(STAGE_VIEWS).toContain(v)
    }
  })

  it('hides permission keys of switched-off modules', () => {
    expect(permHidden({ modules: { riders: false } }, 'riders_hosp')).toBe(true)
    expect(permHidden({ modules: { riders: false } }, 'schedule')).toBe(false)
  })
})
