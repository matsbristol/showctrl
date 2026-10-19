/*
 * Festival setup rules: who has access and how, roles and permissions,
 * departments, the day sheet template and a blank event. Pure functions
 * that return the documents to write, so they can be tested and mirrored
 * by the backend.
 *
 * Access lives in two places (see CLAUDE.md, "Access model"):
 *   members/<uid>          festival role, departments, stages they manage
 *   stageteam/<stageId>    crew on that stage, written by its managers
 */
import { sortStages, stageRoleOf } from '../access/access'
import type { DaySheetTemplate, Dept, EventConfig, EventType, Id, JoinRequest, Level, Member, PermKey, Roles, Snapshot, StageTeam, TapeColor } from '../types/model'
import { DEFAULT_ROLES, DEFAULT_TPL, EVENT_TYPES, defaultDepts } from './constants'
import { rid } from './runsheet'
import { addDays } from './time'

/* ---------------- stage teams ---------------- */

/** A stage's team doc with someone added to or removed from the crew. */
export function setCrew(team: StageTeam | undefined, sid: Id, uid: Id, on: boolean): StageTeam {
  const crew = { ...(team?.crew ?? {}) }
  if (on) crew[uid] = true
  else delete crew[uid]
  return { id: sid, crew }
}

/** User ids of a stage's crew with app access. */
export const stageCrew = (snap: Snapshot, sid: Id) => Object.keys(snap.col.stageteam[sid]?.crew ?? {})

/* ---------------- people with access ---------------- */

/** Everyone with a member record or a crew place anywhere. */
export function usersWithAccess(snap: Snapshot): Id[] {
  const ids = new Set([...Object.keys(snap.col.members), ...Object.values(snap.col.stageteam).flatMap(t => Object.keys(t.crew ?? {}))])
  return [...ids]
}

/** Requests to join from people who don't have any access yet. */
export function pendingRequests(snap: Snapshot): JoinRequest[] {
  return Object.values(snap.col.requests)
    .filter(r => !snap.col.members[r.id] && !Object.values(snap.col.stages).some(s => stageRoleOf(snap, r.id, s.id)))
    .sort((a, b) => a.at - b.at)
}

export interface AccessInput {
  role: string
  person?: Id
  depts: Id[]
  /** Stages this person manages. */
  managerOf: Id[]
  /** Stages this person is crew on. */
  crewOn: Id[]
  /** Demo mode only: a display name. */
  name?: string
}

export interface AccessChanges {
  member: Omit<Member, 'id'>
  /** Stage team docs that change. */
  teams: StageTeam[]
  /** The person's request to join, now handled. */
  clearRequest: boolean
}

/** What to write to give `uid` exactly the access in `input`. */
export function accessChanges(snap: Snapshot, uid: Id, input: AccessInput): AccessChanges {
  const existing = snap.col.members[uid]
  const teams: StageTeam[] = []
  for (const s of sortStages(Object.values(snap.col.stages))) {
    const has = !!snap.col.stageteam[s.id]?.crew?.[uid]
    const want = input.crewOn.includes(s.id)
    if (has !== want) teams.push(setCrew(snap.col.stageteam[s.id], s.id, uid, want))
  }
  return {
    member: {
      ...(existing?.name || input.name ? { name: input.name || existing?.name } : {}),
      role: input.role,
      person: input.person || null,
      depts: input.depts,
      stages: Object.fromEntries(input.managerOf.map(s => [s, 'manager' as const])),
    },
    teams,
    clearRequest: !!snap.col.requests[uid],
  }
}

/** What to write to remove someone's access entirely: every crew place, then their member record. */
export function removeAccessChanges(snap: Snapshot, uid: Id): StageTeam[] {
  return Object.values(snap.col.stages)
    .filter(s => snap.col.stageteam[s.id]?.crew?.[uid])
    .map(s => setCrew(snap.col.stageteam[s.id], s.id, uid, false))
}

/** Appoint or remove a stage manager, keeping their other stages. */
export function setManager(member: Member | undefined, sid: Id, on: boolean): Omit<Member, 'id'> {
  const stages = { ...(member?.stages ?? {}) }
  if (on) stages[sid] = 'manager'
  else delete stages[sid]
  return { ...(member ?? { role: 'none', depts: [] }), stages }
}

/* ---------------- roles ---------------- */

/** A role's level for a key. Admin is always edit everywhere. */
export const roleLevel = (roles: Roles, key: string, k: PermKey): Level => (key === 'admin' ? 2 : roles[key]?.perms?.[k] ?? 0)

export function setRolePerm(roles: Roles, key: string, k: PermKey, level: Level): Roles {
  const r = roles[key]
  if (!r || r.locked) return roles
  return { ...roles, [key]: { ...r, perms: { ...r.perms, [k]: level } } }
}

export function setRoleContacts(roles: Roles, key: string, contacts: boolean): Roles {
  const r = roles[key]
  if (!r || r.locked) return roles
  return { ...roles, [key]: { ...r, contacts } }
}

/** A new role named `label`, starting with the permissions of `copyFrom`. */
export function addRole(roles: Roles, label: string, copyFrom: string): { roles: Roles; key: string } {
  const src = roles[copyFrom] ?? DEFAULT_ROLES.none
  const key = 'r' + rid()
  return { key, roles: { ...roles, [key]: { label, perms: { ...src.perms }, contacts: src.contacts } } }
}

/** Removes a custom role, unless it's built in or someone still has it (returns the reason). */
export function removeRole(snap: Snapshot, roles: Roles, key: string): Roles | string {
  if (DEFAULT_ROLES[key]) return 'Built-in roles can’t be removed.'
  if (Object.values(snap.col.members).some(m => m.role === key)) return 'Move everyone off this role first.'
  const next = { ...roles }
  delete next[key]
  return next
}

/* ---------------- departments ---------------- */

export function upsertDept(depts: Dept[], d: { id?: Id; name: string; tape: TapeColor }): Dept[] {
  const dept: Dept = { id: d.id ?? rid(), name: d.name, tape: d.tape }
  const i = depts.findIndex(x => x.id === dept.id)
  return i >= 0 ? depts.map((x, j) => (j === i ? dept : x)) : [...depts, dept]
}

export const removeDept = (depts: Dept[], id: Id) => depts.filter(d => d.id !== id)

/* ---------------- day sheet template ---------------- */

/** Offsets entered as "minutes before show"; stored as negative numbers. */
const BEFORE_SHOW: (keyof DaySheetTemplate)[] = ['arrival', 'getin', 'loadin', 'access']

export const TEMPLATE_FIELDS: [keyof DaySheetTemplate, string][] = [
  ['arrival', 'Arrival (min before show)'], ['getin', 'Get in (min before show)'],
  ['loadin', 'Load in starts (min before show)'], ['loadinDur', 'Load in length (min)'],
  ['access', 'Stage access (min before show)'], ['changeover', 'Changeover length (min)'],
  ['loadoutAfter', 'Load out starts (min after show)'], ['loadoutDur', 'Load out length (min)'],
  ['departure', 'Departure (min after show)'], ['soundcheckDur', 'Soundcheck length (min)'],
]

/** The template as positive minutes, the way people think about it. */
export function templateForForm(tpl?: Partial<DaySheetTemplate>): Record<keyof DaySheetTemplate, number> {
  const t = { ...DEFAULT_TPL, ...tpl }
  return Object.fromEntries(TEMPLATE_FIELDS.map(([k]) => [k, Math.abs(t[k])])) as Record<keyof DaySheetTemplate, number>
}

/** Back from positive minutes to the stored template (before-show offsets negative). */
export function templateFromForm(v: Record<string, unknown>): DaySheetTemplate {
  return Object.fromEntries(TEMPLATE_FIELDS.map(([k]) => {
    const n = Math.abs(Number(v[k]) || 0)
    return [k, BEFORE_SHOW.includes(k) ? -n : n]
  })) as unknown as DaySheetTemplate
}

/* ---------------- events ---------------- */

/** A new, empty three-day event starting `today`. */
export function blankEvent(today: string, tz = 'Europe/Oslo'): EventConfig {
  return {
    schema: 2, name: 'New festival', type: 'festival', tz, start: today, end: addDays(today, 2),
    terms: { ...EVENT_TYPES.festival.terms }, modules: { accommodation: true, riders: true }, depts: defaultDepts(),
  }
}

/** Changing the event type also changes the vocabulary (Artists / Speakers, Stages / Rooms). */
export function withType(cfg: EventConfig, type: EventType): EventConfig {
  return { ...cfg, type, terms: { ...EVENT_TYPES[type].terms } }
}
