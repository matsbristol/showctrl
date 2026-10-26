// Turns what Claude read from pasted text (ImportResult) into rows the admin can tick, and writes
// the ticked ones. Names are matched to what the event already has, so an import adds to an
// event instead of duplicating it: an existing artist gets new contacts and shows, an existing
// person gets the details they were missing.

import type { DataStore } from '../data/store'
import type { ImportResult } from '../shared/importSchema'
import { MIN, TAPE } from '../types/constants'
import type { Artist, Booking, Collections, Dept, EventConfig, Hotel, Id, ModuleId, Person, RosItem, RosKind, Stage, TapeColor } from '../types/model'
import { locale, tr } from '../i18n'
import { accredLevels } from './accred'
import { buildDaySheet } from './daySheet'
import { rid } from './id'
import { festDay, fromLocal } from './time'

export const IMPORT_GROUPS = ['stages', 'artists', 'shows', 'items', 'people', 'hotels', 'bookings'] as const
export type ImportGroup = (typeof IMPORT_GROUPS)[number]

type Write =
  | { op: 'set'; col: keyof Collections; doc: { id: Id } }
  | { op: 'update'; col: keyof Collections; id: Id; patch: Record<string, unknown> }
  | { op: 'delete'; col: keyof Collections; id: Id }

export interface PlanRow {
  /** Stable across re-plans, so ticks survive a change of default stage. */
  key: string
  group: ImportGroup
  label: string
  detail: string
  isNew: boolean
  /** Something the admin should check, e.g. a guessed end time. */
  warn?: string
  /** Rows that must be imported too (a new artist for their show). */
  needs: string[]
  writes: Write[]
  /** Departments this row adds to the event. */
  depts?: Dept[]
}

export interface ImportPlan {
  rows: PlanRow[]
  /** Artists or items with no stage in the text; they go to `defaultStage`. */
  unplaced: number
  leftover: string
}

export interface EventState {
  cfg: EventConfig
  stages: Record<Id, Stage>
  artists: Record<Id, Artist>
  ros: Record<Id, RosItem>
  people: Record<Id, Person>
  hotels: Record<Id, Hotel>
  bookings: Record<Id, Booking>
}

type StageRef = { id: Id; name: string; template?: Stage['template']; key?: string }

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const val = (s: string | null | undefined) => (s ?? '').trim()
const HHMM = /^\d{1,2}:\d{2}$/

/** "2026-06-12" + "20:30" in the event's time zone, or null if either is malformed. */
function at(date: string, time: string | null, tz: string): number | null {
  if (!time || !HHMM.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return fromLocal(`${date}T${time.padStart(5, '0')}`, tz)
}

/** An end on the same date that comes before the start is after midnight. */
const after = (start: number, end: number | null) => (end === null ? null : end <= start ? end + 24 * 60 * MIN : end)

export function planImport(r: ImportResult, s: EventState, defaultStage: Id | null): ImportPlan {
  const tz = s.cfg.tz
  const rows: PlanRow[] = []
  const fmt = (ms: number) => new Intl.DateTimeFormat(locale(), { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(ms)
  const hm = (ms: number) => new Intl.DateTimeFormat(locale(), { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(ms)

  // Stages: existing by name, then the text's new ones, then any an artist names that the text didn't list.
  const stageBy = new Map<string, StageRef>()
  for (const st of Object.values(s.stages)) stageBy.set(norm(st.name), { id: st.id, name: st.name, template: st.template })
  const usedTapes = new Set(Object.values(s.stages).map(x => x.tape))
  const freeTapes = (Object.keys(TAPE) as TapeColor[]).filter(t => !usedTapes.has(t) && t !== 'white')
  let order = Math.max(-1, ...Object.values(s.stages).map(x => x.order ?? 0))
  const stageRef = (name: string | null, info?: { location: string | null; radio: string | null }): StageRef | null => {
    const k = norm(name)
    if (!k) return null
    const have = stageBy.get(k)
    if (have && !info) return have
    if (have && info) {
      const ex = s.stages[have.id]
      const patch: Record<string, unknown> = {}
      if (ex && !ex.location && val(info.location)) patch.location = val(info.location)
      if (ex && !ex.radio && val(info.radio)) patch.radio = val(info.radio)
      if (ex && Object.keys(patch).length) {
        rows.push({ key: `stage:${k}`, group: 'stages', label: ex.name, detail: Object.values(patch).join(' · '), isNew: false, needs: [], writes: [{ op: 'update', col: 'stages', id: ex.id, patch }] })
      }
      return have
    }
    const id = rid()
    const doc: Stage = { id, name: val(name), tape: freeTapes.shift() ?? 'grey', order: ++order, location: val(info?.location), radio: val(info?.radio) }
    const ref: StageRef = { id, name: doc.name, key: `stage:${k}` }
    stageBy.set(k, ref)
    rows.push({ key: `stage:${k}`, group: 'stages', label: doc.name, detail: [doc.location, doc.radio && tr('Radio {channel}', { channel: doc.radio })].filter(Boolean).join(' · '), isNew: true, needs: [], writes: [{ op: 'set', col: 'stages', doc }] })
    return ref
  }
  for (const st of r.stages) stageRef(st.name, st)
  const fallback = defaultStage && s.stages[defaultStage] ? stageBy.get(norm(s.stages[defaultStage].name))! : [...stageBy.values()][0] ?? null
  let unplaced = 0

  // Artists: existing ones get what they were missing; shows become day sheets.
  const artistBy = new Map<string, { id: Id; name: string; stage: StageRef | null; key?: string }>()
  for (const a of Object.values(s.artists)) artistBy.set(norm(a.name), { id: a.id, name: a.name, stage: stageBy.get(norm(s.stages[a.stage]?.name)) ?? null })
  const explicit = r.items.filter(i => i.artist && i.kind !== 'show' && i.kind !== 'soundcheck')
  const usedExplicit = new Set<number>()

  for (const a of r.artists) {
    const k = norm(a.name)
    if (!k) continue
    const ex = artistBy.get(k)
    let ref = ex
    if (!ex) {
      const st = stageRef(a.stage) ?? fallback
      if (!a.stage) unplaced++
      const id = rid()
      const doc: Artist = {
        id, name: val(a.name), stage: st?.id ?? '', status: 'confirmed', genre: val(a.genre), party: a.party ?? null, notes: val(a.notes),
        contacts: a.contacts.map(c => ({ id: rid(), role: val(c.role) || 'Other', name: val(c.name), phone: val(c.phone), email: val(c.email) })),
      }
      ref = { id, name: doc.name, stage: st, key: `artist:${k}` }
      artistBy.set(k, ref)
      rows.push({
        key: ref.key!, group: 'artists', label: doc.name, isNew: true, needs: st?.key ? [st.key] : [],
        detail: [st?.name, doc.genre, doc.contacts.length && (doc.contacts.length > 1 ? tr('{n} contacts', { n: doc.contacts.length }) : tr('1 contact'))].filter(Boolean).join(' · '),
        warn: !a.stage && st ? tr('Not placed in the text: goes on {name}', { name: st.name }) : undefined,
        writes: [{ op: 'set', col: 'artists', doc }],
      })
    } else {
      const cur = s.artists[ex.id]
      const patch: Record<string, unknown> = {}
      if (!cur.genre && val(a.genre)) patch.genre = val(a.genre)
      if (!cur.party && a.party) patch.party = a.party
      if (val(a.notes) && !norm(cur.notes).includes(norm(a.notes))) patch.notes = [cur.notes, val(a.notes)].filter(Boolean).join('\n')
      const known = new Set(cur.contacts.flatMap(c => [norm(c.name), norm(c.email)]).filter(Boolean))
      const add = a.contacts.filter(c => !known.has(norm(c.name)) && !(c.email && known.has(norm(c.email))))
      if (add.length) patch.contacts = [...cur.contacts, ...add.map(c => ({ id: rid(), role: val(c.role) || 'Other', name: val(c.name), phone: val(c.phone), email: val(c.email) }))]
      if (Object.keys(patch).length) {
        rows.push({
          key: `artist:${k}`, group: 'artists', label: cur.name, isNew: false, needs: [], writes: [{ op: 'update', col: 'artists', id: cur.id, patch }],
          detail: [add.length && (add.length > 1 ? tr('+{n} contacts', { n: add.length }) : tr('+1 contact')), patch.genre as string, patch.notes && tr('notes')].filter(Boolean).join(' · '),
        })
      }
    }

    for (const sh of a.shows) {
      const start = at(sh.date, sh.start, tz)
      if (start === null || !ref!.stage) continue
      const given = after(start, at(sh.date, sh.end, tz))
      const end = given ?? start + 60 * MIN
      let sc = at(sh.date, sh.soundcheck, tz)
      if (sc !== null && sc > start) sc -= 24 * 60 * MIN
      const items = buildDaySheet(ref!.stage, ref!, start, end, sc)
      const day = festDay(start, tz)
      // Times the text gives for this artist's day replace the template's.
      explicit.forEach((it, i) => {
        if (norm(it.artist) !== k) return
        const t0 = at(it.date, it.start, tz)
        if (t0 === null || festDay(t0, tz) !== day) return
        const gen = items.find(x => x.kind === it.kind)
        if (!gen) return
        const t1 = after(t0, at(it.date, it.end, tz))
        gen.end = t1 ?? t0 + (gen.end - gen.start)
        gen.start = t0
        usedExplicit.add(i)
      })
      const old = ex ? Object.values(s.ros).filter(x => x.artist === ex.id && festDay(x.start, tz) === day) : []
      const needs = [ref!.key, ref!.stage.key].filter((x): x is string => !!x)
      rows.push({
        key: `show:${k}:${sh.date}:${sh.start}`, group: 'shows', isNew: !old.length, needs,
        label: ref!.name, detail: `${fmt(start)}–${hm(end)}${sc !== null ? ` · ${tr('soundcheck {time}', { time: hm(sc) })}` : ''} · ${ref!.stage.name}${old.length ? ` · ${old.length > 1 ? tr('replaces {n} items', { n: old.length }) : tr('replaces 1 item')}` : ''}`,
        warn: given === null ? tr('No end time: set to 60 minutes') : undefined,
        writes: [...old.map(x => ({ op: 'delete' as const, col: 'ros' as const, id: x.id })), ...items.map(doc => ({ op: 'set' as const, col: 'ros' as const, doc }))],
      })
    }
  }

  // Other run sheet items: doors, curfew, meetings, and artist times without a show to attach to.
  r.items.forEach((it, i) => {
    if (usedExplicit.has(i) || it.kind === 'show') return
    const start = at(it.date, it.start, tz)
    if (start === null) return
    const art = it.artist ? artistBy.get(norm(it.artist)) : undefined
    const st = stageRef(it.stage) ?? art?.stage ?? fallback
    if (!st) return
    if (!it.stage && !art) unplaced++
    const end = after(start, at(it.date, it.end, tz)) ?? start
    const dup = Object.values(s.ros).some(x => x.stage === st.id && x.kind === it.kind && x.start === start && (x.artist ?? null) === (art?.id ?? null))
    if (dup) return
    const doc: RosItem = { id: rid(), stage: st.id, artist: art?.id ?? null, kind: it.kind as RosKind, title: val(it.title) || art?.name || it.kind, start, end, status: 'pending', delay: 0, notes: '' }
    rows.push({
      key: `item:${i}`, group: 'items', isNew: true, label: doc.title, needs: [art?.key, st.key].filter((x): x is string => !!x),
      detail: `${fmt(start)}${end > start ? `–${hm(end)}` : ''} · ${st.name}`,
      writes: [{ op: 'set', col: 'ros', doc }],
    })
  })

  // People: matched by email, then by name. Unknown departments are added to the event.
  const levels = accredLevels(s.cfg)
  const deptBy = new Map(s.cfg.depts.map(d => [norm(d.name), d]))
  const freeDeptTapes = (Object.keys(TAPE) as TapeColor[]).filter(t => !s.cfg.depts.some(d => d.tape === t))
  const personBy = new Map<string, Person>()
  for (const p of Object.values(s.people)) {
    personBy.set(norm(p.name), p)
    if (p.email) personBy.set(norm(p.email), p)
  }
  r.people.forEach((p, i) => {
    if (!norm(p.name)) return
    let newDept: Dept | undefined
    let dept: Dept | undefined
    if (norm(p.dept)) {
      dept = deptBy.get(norm(p.dept))
      if (!dept) {
        dept = newDept = { id: rid(), name: val(p.dept), tape: freeDeptTapes.shift() ?? 'grey' }
        deptBy.set(norm(p.dept), dept)
      }
    }
    const accred = levels.find(l => norm(l) === norm(p.accred)) ?? null
    const stages = p.stages.map(n => stageRef(n)).filter(x => !!x)
    const needs = stages.map(x => x.key).filter((x): x is string => !!x)
    const warn = p.accred && !accred ? tr('Accreditation “{name}” isn’t one of this event’s levels', { name: p.accred }) : undefined
    const ex = (p.email && personBy.get(norm(p.email))) || personBy.get(norm(p.name))
    if (!ex) {
      const doc: Person = {
        id: rid(), name: val(p.name), title: val(p.title), company: val(p.company), dept: dept?.id ?? null, stages: stages.map(x => x.id),
        phone: val(p.phone), email: val(p.email).toLowerCase(), accred: accred ?? undefined, lead: false, notes: '',
      }
      personBy.set(norm(p.name), doc)
      rows.push({
        key: `person:${i}`, group: 'people', isNew: true, label: doc.name, needs, warn, depts: newDept ? [newDept] : undefined,
        detail: [doc.title, dept?.name, doc.phone, doc.email].filter(Boolean).join(' · '), writes: [{ op: 'set', col: 'people', doc }],
      })
      return
    }
    const patch: Record<string, unknown> = {}
    for (const f of ['title', 'company', 'phone'] as const) if (!ex[f] && val(p[f])) patch[f] = val(p[f])
    if (!ex.email && val(p.email)) patch.email = val(p.email).toLowerCase()
    if (!ex.dept && dept) patch.dept = dept.id
    if (!ex.accred && accred) patch.accred = accred
    const moreStages = stages.map(x => x.id).filter(id => !ex.stages.includes(id))
    if (moreStages.length) patch.stages = [...ex.stages, ...moreStages]
    if (!Object.keys(patch).length) return
    rows.push({
      key: `person:${i}`, group: 'people', isNew: false, label: ex.name, needs, warn, depts: newDept && patch.dept ? [newDept] : undefined,
      detail: Object.entries(patch).map(([f, v]) => (f === 'dept' ? dept?.name : f === 'stages' ? `+${moreStages.map(id => [...stageBy.values()].find(x => x.id === id)?.name ?? '').join(', ')}` : String(v))).join(' · '),
      writes: [{ op: 'update', col: 'people', id: ex.id, patch }],
    })
  })

  // Hotels, then bookings in them.
  const hotelBy = new Map<string, { id: Id; key?: string }>(Object.values(s.hotels).map(h => [norm(h.name), { id: h.id }]))
  for (const h of r.hotels) {
    const k = norm(h.name)
    if (!k) continue
    const ex = Object.values(s.hotels).find(x => norm(x.name) === k)
    if (ex) {
      const patch: Record<string, unknown> = {}
      for (const f of ['address', 'phone', 'contact'] as const) if (!ex[f] && val(h[f])) patch[f] = val(h[f])
      if (Object.keys(patch).length) rows.push({ key: `hotel:${k}`, group: 'hotels', isNew: false, label: ex.name, needs: [], detail: Object.values(patch).join(' · '), writes: [{ op: 'update', col: 'hotels', id: ex.id, patch }] })
      continue
    }
    if (hotelBy.has(k)) continue
    const doc: Hotel = { id: rid(), name: val(h.name), address: val(h.address), contact: val(h.contact), phone: val(h.phone), block: 0, notes: '' }
    hotelBy.set(k, { id: doc.id, key: `hotel:${k}` })
    rows.push({ key: `hotel:${k}`, group: 'hotels', isNew: true, label: doc.name, needs: [], detail: [doc.address, doc.phone].filter(Boolean).join(' · '), writes: [{ op: 'set', col: 'hotels', doc }] })
  }
  r.bookings.forEach((b, i) => {
    let hotel = hotelBy.get(norm(b.hotel))
    if (!hotel && norm(b.hotel)) {
      const doc: Hotel = { id: rid(), name: val(b.hotel), address: '', contact: '', phone: '', block: 0, notes: '' }
      hotel = { id: doc.id, key: `hotel:${norm(b.hotel)}` }
      hotelBy.set(norm(b.hotel), hotel)
      rows.push({ key: hotel.key!, group: 'hotels', isNew: true, label: doc.name, needs: [], detail: '', writes: [{ op: 'set', col: 'hotels', doc }] })
    }
    const art = b.artist ? artistBy.get(norm(b.artist)) : undefined
    const guest = art ? '' : val(b.guest) || val(b.artist)
    if (!hotel || (!art && !guest) || !/^\d{4}-\d{2}-\d{2}$/.test(b.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(b.checkOut)) return
    const dup = Object.values(s.bookings).some(x => x.hotel === hotel.id && x.checkIn === b.checkIn && (art ? x.artist === art.id : norm(x.guest) === norm(guest)))
    if (dup) return
    const doc: Booking = { id: rid(), artist: art?.id ?? null, guest, guestRole: '', hotel: hotel.id, checkIn: b.checkIn, checkOut: b.checkOut, rooms: Math.max(1, Math.round(b.rooms) || 1), roomType: '', status: 'requested', conf: '', notes: '' }
    rows.push({
      key: `booking:${i}`, group: 'bookings', isNew: true, label: art?.name ?? guest, needs: [hotel.key, art?.key].filter((x): x is string => !!x),
      detail: `${val(b.hotel)} · ${b.checkIn} → ${b.checkOut} · ${doc.rooms > 1 ? tr('{n} rooms', { n: doc.rooms }) : tr('1 room')}`,
      writes: [{ op: 'set', col: 'bookings', doc }],
    })
  })

  return { rows, unplaced, leftover: r.leftover.trim() }
}

/** Rows that can be imported: ticked, with everything they need ticked too. */
export function importable(plan: ImportPlan, ticked: Set<string>): PlanRow[] {
  const byKey = new Map(plan.rows.map(r => [r.key, r]))
  const ok = (r: PlanRow, seen = new Set<string>()): boolean =>
    ticked.has(r.key) && r.needs.every(k => { const n = byKey.get(k); return !n || seen.has(k) || ok(n, new Set([...seen, r.key])) })
  return plan.rows.filter(r => ok(r))
}

const MODULE_OF: Partial<Record<ImportGroup, ModuleId>> = { people: 'personnel', hotels: 'accommodation', bookings: 'accommodation' }

/** Writes the rows: departments and modules first, then each collection in dependency order. */
export async function applyImport(store: DataStore, cfg: EventConfig, rows: PlanRow[]): Promise<number> {
  const depts = rows.flatMap(r => r.depts ?? [])
  const mods = [...new Set(rows.map(r => MODULE_OF[r.group]).filter((m): m is ModuleId => !!m))].filter(m => cfg.modules[m] === false)
  if (depts.length || mods.length) {
    await store.setConfig('event', { ...cfg, depts: [...cfg.depts, ...depts], modules: { ...cfg.modules, ...Object.fromEntries(mods.map(m => [m, true])) } })
  }
  const writes = IMPORT_GROUPS.flatMap(g => rows.filter(r => r.group === g).flatMap(r => r.writes))
  for (const w of writes.filter(w => w.op === 'delete')) await store.delete(w.col, w.id)
  const cols = [...new Set(writes.map(w => w.col))]
  for (const col of cols) {
    const sets = writes.filter((w): w is Extract<Write, { op: 'set' }> => w.op === 'set' && w.col === col).map(w => w.doc)
    if (sets.length) await store.setMany(col, sets as never)
    for (const w of writes) if (w.op === 'update' && w.col === col) await store.update(col, w.id, w.patch as never)
  }
  return rows.length
}
