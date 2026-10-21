// Which pages a user can open, ported from HQ_NAV / STAGE_NAV in the prototype.

import type { EventConfig, Id } from '../types/model'
import type { Access } from './access'
import { moduleOfView, moduleOn } from './modules'

// Order is the side-nav order; groups are in src/app/nav.ts.
export const HQ_VIEWS = [
  'overview',
  'schedule', 'screens', 'clocks', 'messages',
  'artists', 'summary', 'lines', 'plots', 'risers', 'risk', 'riders',
  'trucks', 'transport', 'accommodation', 'facilities',
  'personnel', 'documents',
  'admin',
] as const
export const STAGE_VIEWS = [
  'today',
  'runsheet', 'display', 'screens', 'clocks', 'messages',
  'artists', 'summary', 'lines', 'plots', 'risers', 'risk', 'riders',
  'trucks', 'transport', 'facilities',
  'personnel', 'documents', 'setup',
] as const

export type HqView = (typeof HQ_VIEWS)[number]
export type StageView = (typeof STAGE_VIEWS)[number]

export function canOpenHqView(a: Access, cfg: EventConfig | null | undefined, v: HqView): boolean {
  const mod = moduleOfView(v, 'hq')
  if (mod && !moduleOn(cfg, mod)) return false
  switch (v) {
    case 'overview': return a.perm('show') >= 1
    case 'schedule': return a.perm('schedule') >= 1
    case 'artists': return a.perm('artists') >= 1
    case 'risk': return a.perm('risk') >= 1
    case 'trucks': return a.perm('schedule') >= 1
    case 'screens': return a.perm('clocks') >= 1
    case 'summary': return a.perm('artists') >= 1
    case 'lines':
    case 'plots':
    case 'risers': return a.perm('technical') >= 1
    case 'transport': return a.perm('transport') >= 1
    case 'facilities': return a.perm('facilities') >= 1
    case 'documents': return a.anyLv('documents') >= 1
    case 'personnel': return a.perm('personnel') >= 1
    case 'clocks': return a.perm('clocks') >= 1
    case 'messages': return a.anyLv('messages') >= 1
    case 'accommodation': return a.perm('accommodation') >= 1
    case 'riders': return (a.perm('riders_tech') >= 1 || a.perm('riders_hosp') >= 1)
    case 'admin': return a.perm('admin') >= 1
  }
}

export function canOpenStageView(a: Access, cfg: EventConfig | null | undefined, sid: Id, v: StageView): boolean {
  if (!a.canSeeStage(sid)) return false
  const mod = moduleOfView(v, 'stage')
  if (mod && !moduleOn(cfg, mod)) return false
  switch (v) {
    case 'today':
    case 'runsheet': return a.lv('schedule', sid) >= 1
    case 'artists': return a.lv('artists', sid) >= 1
    case 'risk': return a.lv('risk', sid) >= 1
    case 'trucks': return a.lv('schedule', sid) >= 1
    case 'screens': return a.lv('clocks', sid) >= 1
    case 'summary': return a.lv('artists', sid) >= 1
    case 'lines':
    case 'plots':
    case 'risers': return a.lv('technical', sid) >= 1
    case 'transport': return a.lv('transport', sid) >= 1
    case 'facilities': return a.lv('facilities', sid) >= 1
    case 'documents': return a.lv('documents', sid) >= 1
    case 'personnel': return a.lv('personnel', sid) >= 1
    case 'clocks': return a.lv('clocks', sid) >= 1
    // The display follows the run sheet, so it works without the Clocks module.
    case 'display': return a.lv('schedule', sid) >= 1
    case 'messages': return a.lv('messages', sid) >= 1
    case 'riders': return (a.lv('riders_tech', sid) >= 1 || a.lv('riders_hosp', sid) >= 1)
    case 'setup': return a.lv('setup', sid) >= 2 || a.perm('admin') >= 2
  }
}

export function hqViews(a: Access, cfg: EventConfig | null | undefined): HqView[] {
  return a.hqVisible() ? HQ_VIEWS.filter(v => canOpenHqView(a, cfg, v)) : []
}

export function stageViews(a: Access, cfg: EventConfig | null | undefined, sid: Id): StageView[] {
  return STAGE_VIEWS.filter(v => canOpenStageView(a, cfg, sid, v))
}

/** Where the user lands: HQ overview if they see HQ, otherwise their first stage. */
export function homePath(a: Access): string {
  if (a.hqVisible()) return '/hq/overview'
  const st = a.myStages()[0]
  return st ? `/s/${st.id}/today` : '/hq/overview'
}
