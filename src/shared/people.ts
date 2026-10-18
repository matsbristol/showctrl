// Display names and role tags for app users, ported from personName / personTag.

import { STAGE_ROLES } from '../types/constants'
import type { Id, Member, Person, RoleDef, Stage, StageTeam } from '../types/model'
import { sortStages, stageRoleOf } from './access'

export interface Profile { name?: string }

export function personName(
  id: Id | null | undefined,
  members: Readonly<Record<Id, Member>>,
  people: Readonly<Record<Id, Person>>,
  profiles: Readonly<Record<Id, Profile>> = {},
  me?: Id | null,
): string {
  if (!id) return 'Someone'
  const m = members[id]
  if (m?.person && people[m.person]) return people[m.person].name
  if (m?.name) return m.name
  if (profiles[id]?.name) return profiles[id].name!
  return id === me ? 'You' : 'Someone'
}

/** "Production manager", or "Stage manager, Main Stage", or "No access". */
export function personTag(
  uid: Id,
  members: Readonly<Record<Id, Member>>,
  stageteam: Readonly<Record<Id, StageTeam>>,
  stages: Readonly<Record<Id, Stage>>,
  roles: Readonly<Record<string, RoleDef>>,
): string {
  const m = members[uid]
  if (m?.role && m.role !== 'none') return roles[m.role]?.label ?? m.role
  for (const s of sortStages(stages)) {
    const sr = stageRoleOf(members, stageteam, uid, s.id)
    if (sr) return `${STAGE_ROLES[sr]}, ${s.name}`
  }
  return 'No access'
}

/** Avatar colour, stable per id. */
export function personColor(id: string): string {
  const cs = ['#2F6FE0', '#8A4FD3', '#16999A', '#DB4E95', '#EE7A1F', '#2E9E57']
  return cs[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % cs.length]
}

export function initials(name: string): string {
  return name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'
}
