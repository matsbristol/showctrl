/* Display names and labels for app users. */
import type { Id, Roles, Snapshot } from '../types/model'
import { NO_ROLE, STAGE_ROLES } from '../domain/constants'
import { sortStages, stageRoleOf } from '../access/access'

/** A user's name: their linked personnel record, else their member name, else the name on their request to join. */
export function personName(snap: Snapshot, uid: Id | null | undefined, me?: Id | null): string {
  if (!uid) return 'Someone'
  const m = snap.col.members[uid]
  if (m?.person && snap.col.people[m.person]) return snap.col.people[m.person].name
  if (m?.name) return m.name
  const r = snap.col.requests[uid]
  if (r?.name) return r.name
  return uid === me ? 'You' : 'Someone'
}

const roleLabel = (roles: Roles, key: string) => (roles[key] ?? NO_ROLE).label

/** "Production manager", or "Stage manager, Main Stage" for someone with only a stage role. */
export function personTag(snap: Snapshot, uid: Id): string {
  const m = snap.col.members[uid]
  if (m?.role && m.role !== 'none') return roleLabel(snap.roles, m.role)
  for (const s of sortStages(Object.values(snap.col.stages))) {
    const sr = stageRoleOf(snap, uid, s.id)
    if (sr) return `${STAGE_ROLES[sr]}, ${s.name}`
  }
  return 'No access'
}

/** Stable avatar colour from the user id. */
export function personColor(uid: Id): string {
  const colours = ['#2F6FE0', '#8A4FD3', '#16999A', '#DB4E95', '#EE7A1F', '#2E9E57']
  return colours[[...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % colours.length]
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'
