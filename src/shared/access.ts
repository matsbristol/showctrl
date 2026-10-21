// Access rules, ported from the "access" section of public/showctrl.html.
// Pure functions with no React or browser dependency, so the Cloudflare Worker
// can run exactly the same checks as the UI.
//
// Two layers, combined by taking the highest level:
//  1. Festival role (members[uid].role), applies everywhere.
//  2. Stage role (manager or crew), applies to one stage only.

import { DEFAULT_ROLES, STAGE_LV } from '../types/constants'
import type { Artist, Id, Member, Msg, PermKey, PermLevel, RoleDef, RolesConfig, Stage, StageRole, StageTeam } from '../types/model'

/** An admin trying the app as someone else. */
export type Preview =
  | { type: 'role'; role: string }
  | { type: 'stage'; level: StageRole; sid: Id }

export interface AccessState {
  /** The signed-in user id. */
  me: Id | null
  /** The workspace owner is always Festival admin. */
  isOwner?: boolean
  /** Blocks every write, e.g. for a view-only share. */
  readOnly?: boolean
  roles?: RolesConfig | null
  members: Readonly<Record<Id, Member>>
  stageteam: Readonly<Record<Id, StageTeam>>
  stages: Readonly<Record<Id, Stage>>
  preview?: Preview | null
}

/** Permission key, or `setup` (Stage setup, stage roles only). */
export type AccessKey = PermKey | 'setup'

/** Stored roles on top of the defaults, as the prototype merges them. */
export function mergeRoles(stored: RolesConfig | null | undefined): Record<string, RoleDef> {
  return { ...DEFAULT_ROLES, ...stored?.roles }
}

/** A user's stage role: manager (appointed by an admin) or crew (added by a stage manager). */
export function stageRoleOf(
  members: Readonly<Record<Id, Member>>,
  stageteam: Readonly<Record<Id, StageTeam>>,
  uid: Id,
  sid: Id,
): StageRole | null {
  if (members[uid]?.stages?.[sid] === 'manager') return 'manager'
  if (stageteam[sid]?.crew?.[uid]) return 'crew'
  return null
}

export function sortStages(stages: Readonly<Record<Id, Stage>>): Stage[] {
  return Object.values(stages).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

export type Access = ReturnType<typeof createAccess>

/** Builds the access checks for one user against the current data. */
export function createAccess(s: AccessState) {
  const roles = mergeRoles(s.roles)
  const member = s.me ? s.members[s.me] : undefined

  /** The role the user really holds, ignoring preview. */
  const realRole = (): string => (s.isOwner ? 'admin' : member?.role || 'none')

  /** The festival role in effect. A stage preview has no festival role. */
  const role = (): string => s.preview?.type === 'role' ? s.preview.role : s.preview ? 'none' : realRole()

  const roleDef = (r: string = role()): RoleDef => roles[r] ?? DEFAULT_ROLES.none

  /** Festival-wide level for a key. */
  const perm = (k: AccessKey): PermLevel => {
    if (role() === 'admin') return 2
    if (k === 'setup') return 0
    // Roles saved before a permission key existed fall back to that role's default.
    return roleDef().perms?.[k] ?? DEFAULT_ROLES[role()]?.perms[k] ?? 0
  }

  const stageRole = (sid: Id | null | undefined): StageRole | null => {
    if (!sid) return null
    if (s.preview?.type === 'stage') return s.preview.sid === sid ? s.preview.level : null
    if (s.preview?.type === 'role') return null
    return s.me ? stageRoleOf(s.members, s.stageteam, s.me, sid) : null
  }

  /** Effective level for a key on a stage (or festival-wide when sid is null). */
  const lv = (k: AccessKey, sid?: Id | null): PermLevel => {
    const sr = stageRole(sid)
    return Math.max(perm(k), sr ? STAGE_LV[sr][k] ?? 0 : 0) as PermLevel
  }

  const canW = (k: AccessKey, sid?: Id | null): boolean => lv(k, sid) >= 2 && !s.readOnly

  const stagesSorted = () => sortStages(s.stages)
  const myStages = (): Stage[] => stagesSorted().filter(st => stageRole(st.id))
  const visibleStages = (): Stage[] => (perm('schedule') >= 1 || perm('show') >= 1 ? stagesSorted() : myStages())
  const canSeeStage = (sid: Id): boolean => !!s.stages[sid] && visibleStages().some(st => st.id === sid)

  /** Highest level for a key across festival role and all of the user's stages. */
  const anyLv = (k: AccessKey): PermLevel =>
    Math.max(perm(k), ...myStages().map(st => STAGE_LV[stageRole(st.id)!][k] ?? 0), 0) as PermLevel

  /** Whether artist contact details are shown. */
  const artistContacts = (a: Pick<Artist, 'stage'> | null | undefined): boolean =>
    role() === 'admin' || roleDef().contacts || stageRole(a?.stage) === 'manager'

  const myDepts = (): Id[] => member?.depts ?? []

  /** Festival HQ tab. */
  const hqVisible = (): boolean => perm('show') >= 1 || perm('admin') >= 1 || perm('accommodation') >= 1 || perm('personnel') >= 1

  /** No HQ and no stage: the user should ask for access. */
  const hasNoAccess = (): boolean => !hqVisible() && !myStages().length

  /**
   * Whether a message shows for the user. `addressedOnly` limits it to messages
   * meant for them (urgent banner, unread count); otherwise it's the inbox view.
   */
  const canSeeMsg = (m: Msg, addressedOnly = false): boolean => {
    if (!addressedOnly && perm('admin') >= 2) return true
    if (!addressedOnly && m.from === s.me) return true
    const to = m.to
    if (!to || to.t === 'all') return true
    if (to.t === 'dept') return myDepts().includes(to.id)
    if (to.t === 'stage') return !!stageRole(to.id) || (!addressedOnly && perm('messages') >= 1)
    return to.id === s.me
  }

  /** Whether the user can send messages anywhere. */
  const canSendMsgs = (): boolean => !s.readOnly && anyLv('messages') >= 2

  /** Whether the user can send to a target. "Everyone" needs festival-wide message rights. */
  const canSendTo = (to: Msg['to']): boolean =>
    to.t === 'stage' ? canW('messages', to.id) : to.t === 'all' ? canW('messages') : canSendMsgs()

  return {
    me: s.me, roles, member, realRole, role, roleDef, perm, stageRole, lv, canW,
    stagesSorted, myStages, visibleStages, canSeeStage, anyLv, artistContacts, myDepts,
    hqVisible, hasNoAccess, canSeeMsg, canSendMsgs, canSendTo,
  }
}
