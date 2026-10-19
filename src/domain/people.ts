/* Lookups over personnel and app users, shared by several screens. */
import type { Id, Person, Snapshot } from '../types/model'

/** Personnel on a stage (or everyone when no stage), key contacts first, then by name. */
export function peopleFor(people: Record<Id, Person>, sid?: Id | null): Person[] {
  return Object.values(people)
    .filter(p => !sid || (p.stages || []).includes(sid))
    .sort((a, b) => (a.lead === b.lead ? 0 : a.lead ? -1 : 1) || a.name.localeCompare(b.name))
}

/** User ids of a stage's appointed managers. */
export const stageManagers = (snap: Snapshot, sid: Id) =>
  Object.entries(snap.col.members).filter(([, m]) => m.stages?.[sid] === 'manager').map(([id]) => id)

/**
 * The person to call for a stage: an appointed manager's personnel record,
 * else whoever is titled stage manager (not assistant), else the first key contact.
 */
export function stageLead(snap: Snapshot, sid: Id): Person | null {
  for (const uid of stageManagers(snap, sid)) {
    const pid = snap.col.members[uid]?.person
    if (pid && snap.col.people[pid]) return snap.col.people[pid]
  }
  const crew = peopleFor(snap.col.people, sid)
  return crew.find(p => /stage manager/i.test(p.title || '') && !/assistant/i.test(p.title || ''))
    ?? crew.find(p => p.lead)
    ?? null
}
