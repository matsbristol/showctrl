/*
 * Access rules, ported from the prototype. Two layers, combined by taking
 * the highest level:
 *   1. Festival role (members.role), applies everywhere.
 *   2. Stage role (manager or crew), applies to that one stage.
 *
 * These are pure functions of a snapshot and a viewer, so the same rules can
 * be checked in tests and mirrored in the backend's row-level security.
 * The UI enforcing them is not enough on its own.
 */
import type { Artist, Id, Level, ModuleId, PermKey, RoleDef, Snapshot, Stage, StageRole } from '../types/model'
import { DEFAULT_ROLES, NO_ROLE, STAGE_LV, type StagePermKey } from '../domain/constants'

/** "View as": try the app as a festival role, or as manager / crew of one stage. */
export type Preview =
  | { type: 'role'; role: string }
  | { type: 'stage'; sid: Id; level: StageRole }

export interface Viewer {
  /** Signed-in user id, or null when signed out. */
  uid: Id | null
  /** The workspace owner is always Festival admin. */
  isOwner?: boolean
  /** False when the backend refuses all writes for this user (e.g. a view-only share). Default true. */
  canWrite?: boolean
  preview?: Preview | null
}

export const sortStages = (stages: Iterable<Stage>) =>
  [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))

/** A user's own stage role, ignoring any preview. */
export function stageRoleOf(snap: Snapshot, uid: Id | null, sid: Id | null | undefined): StageRole | null {
  if (!uid || !sid) return null
  if (snap.col.members[uid]?.stages?.[sid] === 'manager') return 'manager'
  if (snap.col.stageteam[sid]?.crew?.[uid]) return 'crew'
  return null
}

export interface Access {
  /** Festival role key in effect (after preview). */
  role: string
  roleDef: RoleDef
  isAdmin: boolean
  /** Festival-wide level for a key. */
  perm(k: StagePermKey): Level
  stageRole(sid: Id | null | undefined): StageRole | null
  /** Level for a key, on a stage if given: the higher of festival role and stage role. */
  lv(k: StagePermKey, sid?: Id | null): Level
  /** May edit. */
  canW(k: StagePermKey, sid?: Id | null): boolean
  /** Highest level for a key across the festival role and every stage role held. */
  anyLv(k: StagePermKey): Level
  myStages(): Stage[]
  /** Every stage with festival-wide schedule or overview access, otherwise only the viewer's own. */
  visibleStages(): Stage[]
  canSeeStage(sid: Id): boolean
  /** Festival HQ tab. */
  hqVisible(): boolean
  /** Contact details: roles with `contacts`, admins, and that artist's stage manager. */
  canSeeContacts(artist: Pick<Artist, 'stage'> | null | undefined): boolean
  myDepts(): Id[]
  moduleOn(id: ModuleId): boolean
}

export function createAccess(snap: Snapshot, viewer: Viewer): Access {
  const { uid, preview } = viewer
  const canWrite = viewer.canWrite !== false
  const member = uid ? snap.col.members[uid] : undefined

  const realRole = viewer.isOwner ? 'admin' : member?.role || 'none'
  const role = preview?.type === 'role' ? preview.role : preview ? 'none' : realRole
  const roleDef = (snap.roles ?? DEFAULT_ROLES)[role] ?? NO_ROLE
  const isAdmin = role === 'admin'

  const perm = (k: StagePermKey): Level => (isAdmin ? 2 : roleDef.perms?.[k as PermKey] ?? 0)

  const stageRole = (sid: Id | null | undefined): StageRole | null => {
    if (!sid) return null
    if (preview?.type === 'stage') return preview.sid === sid ? preview.level : null
    if (preview?.type === 'role') return null
    return stageRoleOf(snap, uid, sid)
  }

  const lv = (k: StagePermKey, sid?: Id | null): Level => {
    const g = perm(k)
    const sr = stageRole(sid)
    return sr ? (Math.max(g, STAGE_LV[sr][k] ?? 0) as Level) : g
  }

  const stages = () => sortStages(Object.values(snap.col.stages))
  const myStages = () => stages().filter(s => stageRole(s.id))
  const visibleStages = () => (perm('schedule') >= 1 || perm('show') >= 1 ? stages() : myStages())

  return {
    role,
    roleDef,
    isAdmin,
    perm,
    stageRole,
    lv,
    canW: (k, sid) => lv(k, sid) >= 2 && canWrite,
    anyLv: k => Math.max(perm(k), ...myStages().map(s => STAGE_LV[stageRole(s.id)!][k] ?? 0)) as Level,
    myStages,
    visibleStages,
    canSeeStage: sid => visibleStages().some(s => s.id === sid),
    hqVisible: () => perm('show') >= 1 || perm('admin') >= 1 || perm('accommodation') >= 1 || perm('personnel') >= 1,
    canSeeContacts: a => isAdmin || roleDef.contacts || stageRole(a?.stage) === 'manager',
    myDepts: () => member?.depts ?? [],
    moduleOn: id => snap.cfg?.modules?.[id] !== false,
  }
}
