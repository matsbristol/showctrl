// Which pages a user can open, ported from HQ_NAV / STAGE_NAV in the prototype.

import type { EventConfig, Id } from '../types/model'
import { moduleOn, type Access } from './access'

export const HQ_VIEWS = ['overview', 'schedule', 'artists', 'personnel', 'clocks', 'messages', 'accommodation', 'riders', 'admin'] as const
export const STAGE_VIEWS = ['today', 'runsheet', 'artists', 'personnel', 'clocks', 'messages', 'riders', 'display', 'setup'] as const

export type HqView = (typeof HQ_VIEWS)[number]
export type StageView = (typeof STAGE_VIEWS)[number]

export function canOpenHqView(a: Access, cfg: EventConfig | null | undefined, v: HqView): boolean {
  switch (v) {
    case 'overview': return a.perm('show') >= 1
    case 'schedule': return a.perm('schedule') >= 1
    case 'artists': return a.perm('artists') >= 1
    case 'personnel': return a.perm('personnel') >= 1
    case 'clocks': return a.perm('clocks') >= 1
    case 'messages': return a.anyLv('messages') >= 1
    case 'accommodation': return moduleOn(cfg, 'accommodation') && a.perm('accommodation') >= 1
    case 'riders': return moduleOn(cfg, 'riders') && (a.perm('riders_tech') >= 1 || a.perm('riders_hosp') >= 1)
    case 'admin': return a.perm('admin') >= 1
  }
}

export function canOpenStageView(a: Access, cfg: EventConfig | null | undefined, sid: Id, v: StageView): boolean {
  if (!a.canSeeStage(sid)) return false
  switch (v) {
    case 'today':
    case 'runsheet': return a.lv('schedule', sid) >= 1
    case 'artists': return a.lv('artists', sid) >= 1
    case 'personnel': return a.lv('personnel', sid) >= 1
    case 'clocks':
    case 'display': return a.lv('clocks', sid) >= 1
    case 'messages': return a.lv('messages', sid) >= 1
    case 'riders': return moduleOn(cfg, 'riders') && (a.lv('riders_tech', sid) >= 1 || a.lv('riders_hosp', sid) >= 1)
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
