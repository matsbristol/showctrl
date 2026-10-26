// Display names and role tags for app users, ported from personName / personTag.

import { STAGE_ROLES } from '../types/constants'
import type { Id, Member, Person, RoleDef, Stage, StageTeam } from '../types/model'
import { sortStages, stageRoleOf } from './access'
import { tr } from '../i18n'

export interface Profile { name?: string }

/** A readable stand-in for someone who hasn't given a name yet: "mats.bristol@gmail.com" → "Mats Bristol". */
export function nameFromEmail(email: string): string {
  const words = email.split('@')[0].split(/[._-]+/).filter(w => w && !/^\d+$/.test(w))
  return words.length ? words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : email
}

export function personName(
  id: Id | null | undefined,
  members: Readonly<Record<Id, Member>>,
  people: Readonly<Record<Id, Person>>,
  profiles: Readonly<Record<Id, Profile>> = {},
  me?: Id | null,
): string {
  if (!id) return tr('Someone')
  const m = members[id]
  if (m?.person && people[m.person]) return people[m.person].name
  if (m?.name && m.name !== id) return m.name
  if (profiles[id]?.name) return profiles[id].name!
  if (id.includes('@')) return nameFromEmail(id) // until they give a name: mats.bristol@… → Mats Bristol
  return id === me ? tr('You') : tr('Someone')
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
  if (m?.role && m.role !== 'none') return tr(roles[m.role]?.label ?? m.role)
  for (const s of sortStages(stages)) {
    const sr = stageRoleOf(members, stageteam, uid, s.id)
    if (sr) return `${tr(STAGE_ROLES[sr])}, ${s.name}`
  }
  return tr('No access')
}

/** People listed on a stage (or everyone when sid is null), key contacts first. */
export function peopleFor(people: Readonly<Record<Id, Person>>, sid: Id | null): Person[] {
  return Object.values(people)
    .filter(p => !sid || (p.stages || []).includes(sid))
    .sort((a, b) => (a.lead === b.lead ? 0 : a.lead ? -1 : 1) || a.name.localeCompare(b.name))
}

/** The stage's lead: an appointed manager's personnel record, else whoever's titled stage manager, else a key contact. */
export function stageLead(
  sid: Id,
  members: Readonly<Record<Id, Member>>,
  people: Readonly<Record<Id, Person>>,
): Person | null {
  for (const m of Object.values(members)) if (m.stages?.[sid] === 'manager' && m.person && people[m.person]) return people[m.person]
  const ps = peopleFor(people, sid)
  return ps.find(p => /stage manager/i.test(p.title || '') && !/assistant/i.test(p.title || '')) ?? ps.find(p => p.lead) ?? null
}

/** Avatar colour, stable per id. */
export function personColor(id: string): string {
  const cs = ['#2F6FE0', '#8A4FD3', '#16999A', '#DB4E95', '#EE7A1F', '#2E9E57']
  return cs[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % cs.length]
}

export function initials(name: string): string {
  return name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'
}
