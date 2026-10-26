// People to and from spreadsheets (Excel and CSV). Pure: reading and writing the files
// themselves is in src/app/people/sheetFiles.ts, so this runs in tests and needs no library.
//
// Import: the header row decides which column is what (English or Norwegian names, any order);
// people already on the list are matched by email, then by name, and get the file's values.

import type { Dept, Id, Person, Stage } from '../types/model'
import { rid } from './id'

export const PERSON_FIELDS = ['name', 'first', 'last', 'title', 'company', 'dept', 'stages', 'phone', 'email', 'accred', 'lead', 'notes'] as const
export type PersonField = (typeof PERSON_FIELDS)[number]

/** Header names each field answers to, lower case, English and Norwegian. */
const HEADERS: Record<PersonField, string[]> = {
  name: ['name', 'full name', 'navn', 'fullt navn', 'person'],
  first: ['first name', 'firstname', 'given name', 'fornavn'],
  last: ['last name', 'lastname', 'surname', 'family name', 'etternavn'],
  title: ['title', 'job title', 'role', 'position', 'job', 'tittel', 'stilling', 'rolle', 'funksjon'],
  company: ['company', 'company / supplier', 'firma / leverandør', 'organisation', 'organization', 'employer', 'supplier', 'firma', 'selskap', 'bedrift', 'arbeidsgiver', 'leverandør'],
  dept: ['department', 'dept', 'team', 'avdeling', 'gruppe'],
  stages: ['stage', 'stages', 'works on', 'room', 'rooms', 'scene', 'scener', 'jobber på'],
  phone: ['phone', 'mobile', 'cell', 'telephone', 'tel', 'phone number', 'telefon', 'mobil', 'tlf', 'telefonnummer', 'mobilnummer'],
  email: ['email', 'e-mail', 'mail', 'email address', 'e-post', 'epost', 'e-postadresse'],
  accred: ['accreditation', 'accred', 'access level', 'pass', 'wristband', 'akkreditering', 'adgang', 'tilgangsnivå', 'armbånd'],
  lead: ['lead', 'key contact', 'main contact', 'nøkkelkontakt', 'hovedkontakt', 'ansvarlig'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'notater', 'notat', 'kommentar', 'kommentarer', 'merknad'],
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[\s_]+/g, ' ').replace(/[:*]/g, '').trim()
const cell = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Which field each column holds ('' = ignore), guessed from the header row. */
export function guessColumns(header: unknown[]): (PersonField | '')[] {
  const taken = new Set<PersonField>()
  return header.map(h => {
    const k = norm(h)
    const f = PERSON_FIELDS.find(f => !taken.has(f) && HEADERS[f].includes(k))
      ?? PERSON_FIELDS.find(f => !taken.has(f) && k.length > 2 && HEADERS[f].some(x => k.startsWith(x + ' ') || k.endsWith(' ' + x)))
    if (f) taken.add(f)
    return f ?? ''
  })
}

/** The header row: the first of the first ten rows where at least two columns are recognised. */
export function findHeader(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) if (guessColumns(rows[i]).filter(Boolean).length >= 2) return i
  return 0
}

export interface SheetContext {
  people: Record<Id, Person>
  depts: Dept[]
  stages: Stage[]
  accred: string[]
  /** Used when a row has no department or stage of its own. */
  defaults: { dept: Id | null; stage: Id | null }
  /** Stage managers: every new person is put on this stage, and only people on it are updated. */
  onlyStage: Id | null
  /** Update people already on the list (otherwise they are skipped). */
  update: boolean
}

export interface SheetPlan {
  add: Person[]
  update: { id: Id; name: string; patch: Partial<Person> }[]
  unchanged: number
  /** Rows left out, with the reason, e.g. "Row 7: no name". */
  skipped: string[]
  /** Department names in the file that the event doesn't have. */
  newDepts: string[]
  /** Accreditation values that aren't one of the event's levels (left empty). */
  unknownAccred: string[]
}

const YES = ['yes', 'y', 'x', 'true', '1', 'ja', 'j', '✓', '✔']

/** Reads the rows under the header into new people and changes to existing ones. */
export function planSheet(rows: unknown[][], columns: (PersonField | '')[], ctx: SheetContext, deptIds: Map<string, Id> = new Map()): SheetPlan {
  const plan: SheetPlan = { add: [], update: [], unchanged: 0, skipped: [], newDepts: [], unknownAccred: [] }
  const byEmail = new Map<string, Person>()
  const byName = new Map<string, Person>()
  for (const p of Object.values(ctx.people)) {
    if (p.email) byEmail.set(norm(p.email), p)
    byName.set(norm(p.name), p)
  }
  const deptBy = new Map(ctx.depts.map(d => [norm(d.name), d.id]))
  const stageBy = new Map(ctx.stages.map(s => [norm(s.name), s.id]))
  const seen = new Set<string>()

  rows.forEach((r, i) => {
    const get = (f: PersonField) => { const c = columns.indexOf(f); return c < 0 ? '' : cell(r[c]) }
    if (!r.some(x => cell(x))) return
    const name = get('name') || [get('first'), get('last')].filter(Boolean).join(' ')
    if (!name) { plan.skipped.push(`${i + 1}`); return }
    const email = get('email').toLowerCase()
    const key = email || norm(name)
    if (seen.has(key)) return
    seen.add(key)

    let dept: Id | null | undefined
    const dn = get('dept')
    if (dn) {
      dept = deptBy.get(norm(dn)) ?? deptIds.get(norm(dn))
      if (!dept && !plan.newDepts.some(x => norm(x) === norm(dn))) plan.newDepts.push(dn)
    }
    const stageNames = get('stages').split(/[,;/]|\bog\b|\band\b/).map(norm).filter(Boolean)
    let stages = stageNames.map(n => stageBy.get(n)).filter((x): x is Id => !!x)
    if (ctx.onlyStage) stages = [ctx.onlyStage]
    const av = get('accred')
    const accred = av ? ctx.accred.find(l => norm(l) === norm(av)) : undefined
    if (av && !accred && !plan.unknownAccred.includes(av)) plan.unknownAccred.push(av)
    const leadRaw = get('lead')

    const vals: Partial<Person> = {}
    for (const f of ['title', 'company', 'phone', 'notes'] as const) if (get(f)) vals[f] = get(f)
    if (email) vals.email = email
    if (dept) vals.dept = dept
    if (accred) vals.accred = accred
    if (leadRaw) vals.lead = YES.includes(norm(leadRaw))

    const ex = (email && byEmail.get(email)) || byName.get(norm(name))
    if (!ex) {
      plan.add.push({
        id: rid(), name, title: '', company: '', phone: '', email: '', notes: '', lead: false,
        ...vals, dept: vals.dept ?? (dn ? null : ctx.defaults.dept),
        stages: stages.length || stageNames.length ? stages : ctx.defaults.stage ? [ctx.defaults.stage] : [],
      })
      return
    }
    if (!ctx.update) { plan.unchanged++; return }
    if (ctx.onlyStage && !ex.stages.includes(ctx.onlyStage)) { plan.skipped.push(`${i + 1}`); return }
    const patch: Partial<Person> = {}
    for (const [f, v] of Object.entries(vals) as [keyof Person, never][]) if (ex[f] !== v) (patch as Record<string, unknown>)[f] = v
    if (name !== ex.name && email && byEmail.get(email) === ex) patch.name = name
    const more = stages.filter(s => !ex.stages.includes(s))
    if (more.length) patch.stages = [...ex.stages, ...more]
    if (Object.keys(patch).length) plan.update.push({ id: ex.id, name: ex.name, patch })
    else plan.unchanged++
  })
  return plan
}

/** The columns an export has, in order. Import reads these headers back. */
export const EXPORT_FIELDS = ['name', 'title', 'company', 'dept', 'stages', 'phone', 'email', 'accred', 'lead', 'notes'] as const

/** People as rows of text, header first, ready for a sheet or CSV. */
export function peopleRows(list: Person[], ctx: { depts: Dept[]; stages: Record<Id, Stage>; headers: Record<(typeof EXPORT_FIELDS)[number], string>; yes: string; hq: string }, extra?: { header: string; value: (p: Person) => string }): string[][] {
  const head = EXPORT_FIELDS.map(f => ctx.headers[f])
  if (extra) head.push(extra.header)
  return [head, ...list.map(p => {
    const row = [
      p.name, p.title ?? '', p.company ?? '', ctx.depts.find(d => d.id === p.dept)?.name ?? '',
      p.stages.length ? p.stages.map(s => ctx.stages[s]?.name).filter(Boolean).join(', ') : ctx.hq,
      p.phone ?? '', p.email ?? '', p.accred ?? '', p.lead ? ctx.yes : '', p.notes ?? '',
    ]
    if (extra) row.push(extra.value(p))
    return row
  })]
}

/* ---------- CSV ---------- */

/** Splits CSV text into rows. Handles quotes; the delimiter (; , or tab) is taken from the first line. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const first = src.slice(0, src.search(/\r?\n|$/))
  const count = (c: string) => first.split(c).length
  const sep = ['\t', ';', ','].reduce((best, c) => (count(c) > count(best) ? c : best), ',')
  const rows: string[][] = []
  let row: string[] = []
  let f = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"' && src[i + 1] === '"') { f += '"'; i++ }
      else if (c === '"') q = false
      else f += c
    } else if (c === '"' && f === '') q = true
    else if (c === sep) { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(f); rows.push(row); row = []; f = ''
    } else f += c
  }
  if (f || row.length) { row.push(f); rows.push(row) }
  return rows
}

/** Rows as CSV, every field quoted when needed. A leading =, +, - or @ is escaped so Excel doesn't run it as a formula. */
export function toCsv(rows: string[][], sep = ','): string {
  const esc = (v: string) => {
    const s = /^[=+\-@]/.test(v) && !/^\+?[\d\s()-]+$/.test(v) ? `'${v}` : v
    return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map(r => r.map(esc).join(sep)).join('\r\n') + '\r\n'
}
