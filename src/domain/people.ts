/* Lookups over personnel and app users, shared by several screens. */
import type { Dept, Id, Person, Snapshot } from '../types/model'
import { tapeHex } from './constants'

export const deptName = (depts: Dept[], id?: Id | null) => depts.find(d => d.id === id)?.name ?? ''
export const deptTape = (depts: Dept[], id?: Id | null) => tapeHex(depts.find(d => d.id === id)?.tape)

/** The app user linked to a personnel record, if they have access. */
export const personUser = (snap: Snapshot, pid: Id) =>
  Object.keys(snap.col.members).find(uid => snap.col.members[uid].person === pid)

export interface PeopleFilter {
  /** Only people on this stage. */
  stage?: Id
  dept?: Id
  /** Matches name, title, company, phone or email. */
  q?: string
}

/** The personnel list: key contacts first, then by department, then by name. */
export function filterPeople(people: Record<Id, Person>, depts: Dept[], f: PeopleFilter = {}): Person[] {
  const needle = (f.q ?? '').trim().toLowerCase()
  return Object.values(people)
    .filter(p =>
      (!f.stage || (p.stages || []).includes(f.stage)) &&
      (!f.dept || p.dept === f.dept) &&
      (!needle || [p.name, p.title, p.company, p.phone, p.email].join(' ').toLowerCase().includes(needle)))
    .sort((a, b) =>
      (b.lead ? 1 : 0) - (a.lead ? 1 : 0) ||
      deptName(depts, a.dept).localeCompare(deptName(depts, b.dept)) ||
      a.name.localeCompare(b.name))
}

/** A phone number: optional +, then at least six digits, spaces, brackets or dashes. */
const PHONE = /^\+?[\d\s()-]{6,}$/

/**
 * Reads a crew list pasted from a spreadsheet or typed by hand: one person
 * per line, fields split by tabs, semicolons or commas. The first field is
 * the name; phone and email are recognised wherever they are; the other
 * fields are job title, then company.
 */
export function parseCrewList(text: string): Pick<Person, 'name' | 'title' | 'company' | 'phone' | 'email'>[] {
  return text.split('\n')
    // Split on a comma only when something follows it, so "Hansen, " keeps its name.
    .map(line => line.split(/\t|;|,(?=\s*\S)/).map(x => x.trim()))
    .filter(r => r[0])
    .map(r => {
      const phone = r.slice(1).find(x => PHONE.test(x)) ?? ''
      const email = r.slice(1).find(x => x.includes('@')) ?? ''
      const rest = r.slice(1).filter(x => x && x !== phone && x !== email)
      return { name: r[0], title: rest[0] ?? '', company: rest[1] ?? '', phone, email }
    })
}

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
