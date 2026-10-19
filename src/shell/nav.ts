/*
 * Workspaces and their sections.
 *
 *   /hq/:view/:arg?            Festival HQ
 *   /s/:stageId/:view/:arg?    one stage's workspace
 *
 * Which sections appear depends on the viewer's access (see access.ts).
 * A section that isn't in someone's nav is also refused if they type its URL.
 */
import type { Access } from '../access/access'
import type { Id, Snapshot, Terms } from '../types/model'
import { termsOf } from '../domain/constants'
import type { IconName } from './Icon'

export type HqView = 'overview' | 'schedule' | 'artists' | 'personnel' | 'clocks' | 'messages' | 'accommodation' | 'riders' | 'admin'
export type StageView = 'today' | 'runsheet' | 'artists' | 'personnel' | 'clocks' | 'messages' | 'riders' | 'display' | 'setup'
/** One artist's page, reachable from either workspace: /hq/artist/:id or /s/:sid/artist/:id. */
export type DetailView = 'artist'

export interface NavItem<V extends string = string> {
  view: V
  label: string
  icon: IconName
  /** Draw a divider above this item. */
  sep?: boolean
}

/** 'hq' or a stage id. */
export type Ctx = 'hq' | Id

export const hqPath = (view: HqView | DetailView = 'overview', arg?: string) => `/hq/${view}${arg ? '/' + encodeURIComponent(arg) : ''}`
export const stagePath = (sid: Id, view: StageView | DetailView = 'today', arg?: string) =>
  `/s/${encodeURIComponent(sid)}/${view}${arg ? '/' + encodeURIComponent(arg) : ''}`
export const ctxPath = (ctx: Ctx, view: string, arg?: string) =>
  ctx === 'hq' ? hqPath(view as HqView, arg) : stagePath(ctx, view as StageView, arg)

export function hqNav(a: Access, t: Terms): NavItem<HqView>[] {
  const items: (NavItem<HqView> & { ok: boolean })[] = [
    { view: 'overview', label: 'Overview', icon: 'overview', ok: a.perm('show') >= 1 },
    { view: 'schedule', label: 'Running order', icon: 'schedule', ok: a.perm('schedule') >= 1 },
    { view: 'artists', label: t.performers, icon: 'artists', ok: a.perm('artists') >= 1 },
    { view: 'personnel', label: 'Personnel', icon: 'personnel', ok: a.perm('personnel') >= 1 },
    { view: 'clocks', label: 'Clocks', icon: 'clocks', ok: a.perm('clocks') >= 1 },
    // Messages in HQ include stage channels, so stage crew who can message anywhere see it.
    { view: 'messages', label: 'Messages', icon: 'messages', ok: a.anyLv('messages') >= 1 },
    { view: 'accommodation', label: 'Accommodation', icon: 'accommodation', ok: a.moduleOn('accommodation') && a.perm('accommodation') >= 1 },
    { view: 'riders', label: 'Riders', icon: 'riders', ok: a.moduleOn('riders') && (a.perm('riders_tech') >= 1 || a.perm('riders_hosp') >= 1) },
    { view: 'admin', label: 'Admin', icon: 'admin', ok: a.perm('admin') >= 1, sep: true },
  ]
  return items.filter(i => i.ok).map(({ ok: _ok, ...i }) => i)
}

export function stageNav(a: Access, sid: Id, t: Terms): NavItem<StageView>[] {
  const items: (NavItem<StageView> & { ok: boolean })[] = [
    { view: 'today', label: 'Today', icon: 'today', ok: a.lv('schedule', sid) >= 1 },
    { view: 'runsheet', label: 'Run sheet', icon: 'runsheet', ok: a.lv('schedule', sid) >= 1 },
    { view: 'artists', label: t.performers, icon: 'artists', ok: a.lv('artists', sid) >= 1 },
    { view: 'personnel', label: 'Crew & contacts', icon: 'personnel', ok: a.lv('personnel', sid) >= 1 },
    { view: 'clocks', label: 'Clocks', icon: 'clocks', ok: a.lv('clocks', sid) >= 1 },
    { view: 'messages', label: 'Messages', icon: 'messages', ok: a.lv('messages', sid) >= 1 },
    { view: 'riders', label: 'Riders', icon: 'riders', ok: a.moduleOn('riders') && (a.lv('riders_tech', sid) >= 1 || a.lv('riders_hosp', sid) >= 1) },
    { view: 'display', label: `${t.stage} display`, icon: 'display', ok: a.lv('clocks', sid) >= 1, sep: true },
    // Stage setup: that stage's managers, or a festival admin.
    { view: 'setup', label: `${t.stage} setup`, icon: 'setup', ok: a.lv('setup', sid) >= 2 || a.perm('admin') >= 2 },
  ]
  return items.filter(i => i.ok).map(({ ok: _ok, ...i }) => i)
}

/** Where someone lands: HQ if they can see it, else their first stage. */
export function homePath(a: Access): string {
  if (a.hqVisible()) return hqPath('overview')
  const st = a.myStages()[0]
  return st ? stagePath(st.id, 'today') : hqPath('overview')
}

export type PageResult =
  | { kind: 'setup' }
  | { kind: 'denied'; message?: string }
  | { kind: 'ok'; item?: NavItem }

/**
 * Decides whether a URL can be shown to this viewer.
 * `item` is the matching nav entry (absent for an artist page).
 */
export function resolvePage(a: Access, snap: Snapshot, ctx: Ctx, view: string, arg?: string): PageResult {
  if (!snap.cfg) return { kind: 'setup' }
  const t = termsOf(snap.cfg)
  if (ctx !== 'hq') {
    if (!snap.col.stages[ctx]) return { kind: 'denied', message: `This ${t.stage.toLowerCase()} no longer exists.` }
    if (!a.canSeeStage(ctx)) return { kind: 'denied', message: `You don't have access to this ${t.stage.toLowerCase()}.` }
  } else if (!a.hqVisible()) {
    return { kind: 'denied' }
  }
  if (view === 'artist') {
    // An artist page is visible to anyone who can view artists on that artist's stage.
    const artist = arg ? snap.col.artists[arg] : undefined
    if (!artist) return { kind: 'denied', message: `This ${t.performer.toLowerCase()} no longer exists.` }
    return a.lv('artists', artist.stage) >= 1 ? { kind: 'ok' } : { kind: 'denied' }
  }
  const nav = ctx === 'hq' ? hqNav(a, t) : stageNav(a, ctx, t)
  const item = nav.find(n => n.view === view)
  return item ? { kind: 'ok', item } : { kind: 'denied' }
}
