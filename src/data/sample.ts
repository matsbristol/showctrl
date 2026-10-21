// The demo festival, ported from buildSample() in public/showctrl.html.
// Day 1 is today, with statuses set relative to the current time and The Tent running late.

import { buildDaySheet } from '../lib/daySheet'
import { parseTrucks } from '../lib/trucks'
import { addDays, festDay, fromLocal } from '../lib/time'
import { DEFAULT_ROLES, DEFAULT_TPL, EVENT_TYPES, HOUR, KINDS, MIN, SCHEMA_VERSION, defaultDepts } from '../types/constants'
import type { Accred, ArtistContact, EventConfig, Id, Member, RiderItem, RiderStatus, RiskLevel, RosItem, TapeColor } from '../types/model'
import { emptyCollections, type LocalData } from './collections'

/** An empty three-day festival starting today, with one admin user (the demo persona `demo-admin`). */
export function blankEvent(t: number = Date.now()): LocalData {
  const tz = 'Europe/Oslo'
  const d0 = festDay(t, tz)
  const col = emptyCollections()
  col.members['demo-admin'] = { id: 'demo-admin', name: 'Festival admin', role: 'admin', person: null, depts: [], stages: {} }
  return {
    cfg: {
      schema: SCHEMA_VERSION, name: 'New festival', type: 'festival', tz, start: d0, end: addDays(d0, 2),
      terms: EVENT_TYPES.festival.terms, modules: { accommodation: true, riders: true }, depts: defaultDepts(),
    },
    roles: { roles: structuredClone(DEFAULT_ROLES) },
    col,
  }
}

const eff = (r: RosItem) => ({ s: r.start + (r.delay || 0), e: r.end + (r.delay || 0) })

export function buildSample(t: number = Date.now()): LocalData {
  const tz = 'Europe/Oslo'
  const d0 = festDay(t, tz)
  const cfg: EventConfig = {
    schema: SCHEMA_VERSION, name: 'Nordlys Open Air 2026', type: 'festival', tz, start: d0, end: addDays(d0, 2), visitors: 200000,
    terms: EVENT_TYPES.festival.terms, modules: { accommodation: true, riders: true }, depts: defaultDepts(),
  }
  const col = emptyCollections()

  const STG: { id: Id; name: string; tape: TapeColor; order: number; location: string; radio: string; capacity: number; lens: number[]; co: number; base: string; off: number }[] = [
    { id: 'main', name: 'Main Stage', tape: 'red', order: 0, location: 'Festival field, south', radio: 'Ch 2', capacity: 60000, lens: [60, 75, 90], co: 45, base: '18:00', off: 105 },
    { id: 'fjord', name: 'Fjord Stage', tape: 'blue', order: 1, location: 'Waterfront', radio: 'Ch 3', capacity: 25000, lens: [60, 60, 75], co: 30, base: '17:00', off: 65 },
    { id: 'tent', name: 'The Tent', tape: 'yellow', order: 2, location: 'North field', radio: 'Ch 4', capacity: 8000, lens: [45, 60, 60], co: 30, base: '16:30', off: 30 },
    { id: 'club', name: 'Harbour Club', tape: 'purple', order: 3, location: 'Old warehouse, pier 3', radio: 'Ch 5', capacity: 2500, lens: [60, 60, 90], co: 30, base: '21:00', off: 140 },
    { id: 'forest', name: 'Forest Stage', tape: 'green', order: 4, location: 'Birch grove', radio: 'Ch 6', capacity: 5000, lens: [45, 45, 60], co: 20, base: '15:00', off: 10 },
  ]
  for (const s of STG) {
    col.stages[s.id] = { id: s.id, name: s.name, tape: s.tape, order: s.order, location: s.location, radio: s.radio, capacity: s.capacity, template: { ...DEFAULT_TPL, changeover: s.co } }
  }

  const names = ['The Velvet Arcs', 'Mira Solberg', 'Kollaps Kollektiv', 'Hollow Pines', 'DJ Saltvann', 'Aune & the Tides', 'Bråk', 'Signe Vale Trio', 'Northbound Static', 'Lua Ferreira', 'Glass Harbour', 'Grålys', 'Ola Rein Band', 'Kestrel Line', 'Neon Fjord', 'Halvard & Hjertene', 'Paper Satellites', 'Iris Kalmar', 'The Low Orbit', 'Sølvmåke', 'Ruby Akintola', 'Frost Assembly', 'Midnight Ferry', 'Vestkant Soundsystem', 'Copper Lanterns', 'Elin Myhre', 'The Quiet Engines', 'Bølgeblikk', 'Saffron Riot', 'Tidevann', 'Jonah Okafor', 'Wild Gulls', 'Nattsvermer', 'Electric Moss', 'Hanna Lyse', 'The Iron Rivers', 'Polar Disco', 'Stille Storm', 'Marta Quint', 'Ghost Orchard', 'Fyrlykt', 'Sunniva Bakke', 'Low Tide Choir', 'Pixel Saints', 'Granitt']
  const genres = ['Indie rock', 'Singer-songwriter', 'Punk', 'Folk', 'House', 'Pop', 'Hardcore', 'Jazz', 'Post-rock', 'Electronica', 'Dream pop', 'Shoegaze', 'Americana', 'Alt rock', 'Synthwave', 'Viser', 'Indie pop', 'Electronic', 'Space rock', 'Pop']
  const homes = ['Europe/London', 'Europe/Oslo', 'Europe/Oslo', 'Europe/Stockholm', 'Europe/Berlin', 'America/New_York', 'Europe/Copenhagen', 'America/Los_Angeles']
  const FN = ['Hanne', 'Mark', 'Lise', 'Petter', 'Johan', 'Eva', 'Siri', 'Lars', 'Emma', 'Noah', 'Ida', 'Jakob', 'Nora', 'Sander', 'Thea', 'Marius', 'Ingrid', 'Henrik', 'Sofie', 'Magnus', 'Leah', 'Tobias', 'Maja', 'Even']
  const LN = ['Aas', 'Kim', 'Moe', 'Lie', 'Berg', 'Dahl', 'Holm', 'Vik', 'Strand', 'Bakke', 'Lund', 'Haugen', 'Nilsen', 'Larsen', 'Brekke', 'Solheim']
  let pc = 0
  const phone = () => `+47 9${String(10000000 + (pc++ * 7349251) % 89999999).slice(0, 2)} ${String(10000 + (pc * 4231) % 89999).slice(0, 2)} ${String(100 + (pc * 37) % 899)}`
  const round = (ms: number) => Math.round(ms / (15 * MIN)) * 15 * MIN
  const slug = (nm: string) => nm.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)

  // running order: three days, three acts per stage per day
  let ai = 0
  for (const dn of [0, 1, 2]) {
    const day = addDays(d0, dn)
    for (const s of STG) {
      let cur = dn === 0 ? round(t - s.off * MIN) : fromLocal(`${day}T${s.base}`, tz)!
      if (s.id === 'main') { const id = `dr${dn}`; col.ros[id] = { id, stage: 'main', title: 'Gates open', kind: 'doors', start: cur - 60 * MIN, end: cur - 60 * MIN, status: 'pending', delay: 0 } }
      const n = s.lens.length
      for (let k = 0; k < n; k++) {
        const len = s.lens[k]; const aid = 'a' + ai; const nm = names[ai % names.length]; ai++
        const contacts: ArtistContact[] = [
          { id: 'c1', role: 'Tour manager', name: `${FN[ai % FN.length]} ${LN[(ai * 3) % LN.length]}`, phone: phone(), email: `tm@${slug(nm) || 'band'}.example` },
          ...(ai % 2 ? [{ id: 'c2', role: 'FOH engineer', name: `${FN[(ai + 5) % FN.length]} ${LN[(ai * 5) % LN.length]}`, phone: phone(), email: '' }] : []),
          ...(k === n - 1 ? [{ id: 'c3', role: 'Production manager', name: `${FN[(ai + 9) % FN.length]} ${LN[(ai * 7) % LN.length]}`, phone: phone(), email: `prod@${slug(nm)}.example` }] : []),
        ]
        col.artists[aid] = {
          id: aid, name: nm, stage: s.id, genre: genres[ai % genres.length], status: 'confirmed', party: 4 + (ai * 7) % 12, home: homes[ai % homes.length],
          vehicles: k === n - 1 ? '2 trucks, 2 sleeper buses' : ai % 3 ? '1 splitter van' : '1 truck, 1 sleeper bus', notes: '', contacts,
        }
        const sc = k === n - 1 ? cur - (dn === 0 ? 5 * HOUR : 4 * HOUR) : null
        buildDaySheet(col.stages[s.id], col.artists[aid], cur, cur + len * MIN, sc).forEach((it, j) => { it.id = `${aid}_${j}`; col.ros[it.id] = it })
        cur += len * MIN + s.co * MIN
      }
      if (s.id === 'main') { const id = `cf${dn}`; const e = cur - s.co * MIN + 15 * MIN; col.ros[id] = { id, stage: 'main', title: 'Curfew', kind: 'curfew', start: e, end: e, status: 'pending', delay: 0 } }
    }
  }

  // day 1: statuses relative to now, The Tent running late
  const tentLate = Object.values(col.ros).filter(r => r.stage === 'tent' && festDay(r.start, tz) === d0 && r.start > t - 15 * MIN).sort((a, b) => a.start - b.start)
  tentLate.forEach((r, i) => { r.delay = 10 * MIN; if (i === 0) r.delayNote = 'Late arrival from airport' })
  for (const r of Object.values(col.ros)) {
    if (festDay(r.start, tz) !== d0) continue
    const e = eff(r)
    if (e.e < t) r.status = 'done'
    else if (e.s <= t && e.e > t && KINDS[r.kind as keyof typeof KINDS].track === 'stage' && r.kind !== 'access') r.status = 'live'
    if (r.kind === 'show' && r.artist) {
      const a = col.artists[r.artist]
      a.status = r.status === 'done' ? 'done' : r.status === 'live' ? 'on stage' : e.s - t < 60 * MIN ? 'ready' : e.s - t < 4 * HOUR ? 'backstage' : 'arrived'
    }
  }
  for (const r of Object.values(col.ros)) if (r.kind === 'show' && r.artist && festDay(r.start, tz) === addDays(d0, 1)) col.artists[r.artist].status = 'travelling'

  // personnel per stage + HQ
  const STAFF: [string, Id, Accred, boolean][] = [['Stage manager', 'stage', 'Stage', true], ['Assistant stage manager', 'stage', 'Stage', false], ['Production runner', 'prod', 'Stage', false], ['Audio crew chief', 'audio', 'Stage', true], ['Monitor tech', 'audio', 'Stage', false], ['Lighting crew chief', 'light', 'Stage', false], ['Backline tech', 'backline', 'Stage', false], ['Stagehand lead', 'stage', 'Stage', false], ['Security lead', 'security', 'Site', true], ['Artist liaison', 'al', 'Backstage', false]]
  const COMP: Record<Id, string> = { audio: 'Nordic Sound AS', light: 'LysTeknikk AS', backline: 'Backline Bergen', security: 'Vakt & Sikring' }
  let pi = 0
  const person = (title: string, dept: Id, accred: Accred, lead: boolean, stages: Id[]) => {
    const fn = FN[pi % FN.length], ln = LN[(pi * 7 + Math.floor(pi / FN.length) + 3) % LN.length]
    const id = 'p' + pi++
    col.people[id] = { id, name: `${fn} ${ln}`, title, dept, accred, lead, stages, phone: phone(), email: `${fn.toLowerCase()}.${ln.toLowerCase()}@nordlys.example`, company: COMP[dept] || '', notes: '' }
    return id
  }
  const stagePeople: Record<Id, Id[]> = {}
  for (const s of STG) stagePeople[s.id] = STAFF.map(([title, d, acc, lead]) => person(title, d, acc, lead, [s.id]))
  const HQ: [string, Id, Accred][] = [['Festival director', 'prod', 'AAA'], ['Head of production', 'prod', 'AAA'], ['Head of artist liaison', 'al', 'AAA'], ['Hospitality manager', 'hosp', 'Backstage'], ['Transport coordinator', 'transport', 'Production'], ['Site manager', 'site', 'AAA'], ['Head of security', 'security', 'AAA'], ['Medical coordinator', 'site', 'Production'], ['Accreditation office', 'prod', 'Production']]
  const hqPeople = HQ.map(([title, d, acc]) => person(title, d, acc, true, []))

  // app users (demo personas)
  const m = (id: Id, role: string, pid: Id, extra: Partial<Member> = {}) => {
    const p = col.people[pid]
    col.members[id] = { id, name: p.name, role, person: pid, depts: p.dept ? [p.dept] : [], stages: {}, ...extra }
  }
  m('demo-admin', 'admin', hqPeople[0])
  m('demo-pm', 'pm', hqPeople[1])
  m('demo-al', 'liaison', hqPeople[2])
  m('demo-hosp', 'hosp', hqPeople[3])
  for (const s of STG) m('demo-sm-' + s.id, 'none', stagePeople[s.id][0], { stages: { [s.id]: 'manager' } })
  for (const sid of ['main', 'tent']) {
    for (const k of [3, 6]) {
      const uid = `demo-crew-${sid}-${k}`
      m(uid, 'none', stagePeople[sid][k])
      col.stageteam[sid] ??= { id: sid, crew: {} }
      col.stageteam[sid].crew[uid] = true
    }
  }

  // trucks & docks: a load bay per stage, a staging area and a truck park; trucks on load in and load out
  for (const s of STG) col.locations[`lb-${s.id}`] = { id: `lb-${s.id}`, name: `Load bay · ${s.name}`, kind: 'loadbay', stage: s.id, capacity: s.id === 'main' ? 2 : 1, notes: '' }
  col.locations['staging-n'] = { id: 'staging-n', name: 'Staging area North', kind: 'staging', stage: null, notes: 'Wait here until called to the load bay on Ch 1' }
  col.locations['park-p3'] = { id: 'park-p3', name: 'Truck park P3', kind: 'truckpark', stage: null, notes: 'Overnight parking, gate 7' }
  for (const r of Object.values(col.ros)) {
    if ((r.kind !== 'loadin' && r.kind !== 'loadout') || !r.artist) continue
    const trucks = parseTrucks(col.artists[r.artist].vehicles)
    if (!trucks) continue
    r.trucks = trucks
    r.dest = r.kind === 'loadin' && trucks > 1 ? 'staging-n' : `lb-${r.stage}`
  }

  // risk assessments: mostly green, some orange, a few red, a few not assessed yet
  const RISK: [RiskLevel, string[], string][] = [
    ['orange', ['Crowd surge / moshing', 'Expected capacity crowd'], 'Extra pit security, barrier check before the set.'],
    ['orange', ['Pyrotechnics'], 'Pyro permit on file. Fire watch side stage.'],
    ['red', ['Crowd surge / moshing', 'Crowd surfing / stage diving', 'Alcohol / drugs expected'], 'Briefing with pit crew 30 min before. Medics at front of stage. Stop-show procedure agreed with tour manager.'],
    ['orange', ['Young audience'], 'Front-of-stage water and extra stewards.'],
    ['red', ['High-profile artist / security threat'], 'Close protection team. Artist entrance via gate 7 only.'],
  ]
  Object.keys(col.artists).forEach((aid, i) => {
    const h = (i * 37) % 20
    if (h === 19) return // not assessed yet
    const [level, factors, notes] = h < 13 ? ['green' as RiskLevel, [] as string[], ''] : RISK[(i * 7) % RISK.length]
    col.risks[aid] = { id: aid, artist: aid, level, factors, notes, by: 'demo-pm', at: t - (i % 5) * HOUR }
  })

  // hotels & bookings
  col.hotels.h1 = { id: 'h1', name: 'Fjordhotellet', address: 'Strandgata 12', contact: 'Groups desk', phone: '+47 69 00 00 01', block: 30, notes: 'Late check-in until 04:00' }
  col.hotels.h2 = { id: 'h2', name: 'Harbour Inn', address: 'Brygga 3', contact: 'Reception', phone: '+47 69 00 00 02', block: 18, notes: 'Crew breakfast from 06:30' }
  col.hotels.h3 = { id: 'h3', name: 'Skogly Lodge', address: 'Skogveien 40', contact: 'Nina', phone: '+47 69 00 00 03', block: 12, notes: 'Shuttle to site every 30 min' }
  Object.values(col.artists).forEach((a, i) => {
    if (i % 4 === 3) return
    const sh = Object.values(col.ros).find(r => r.artist === a.id && r.kind === 'show')!
    const night = festDay(sh.start, tz)
    col.bookings['b' + i] = {
      id: 'b' + i, artist: a.id, hotel: ['h1', 'h2', 'h3'][i % 3], checkIn: night, checkOut: addDays(night, 1), rooms: Math.max(1, Math.ceil((a.party ?? 1) / 3)),
      roomType: 'double', status: night === d0 ? 'checked in' : i % 3 === 1 ? 'requested' : 'confirmed', conf: 'NL' + (48211 + i * 37),
    }
  })

  // riders
  const tech: [string, Id][] = [['Drum riser 8×8 ft, 60 cm high', 'stage'], ['6 wedges on 6 mixes', 'audio'], ['2 × wireless SM58', 'audio'], ['8 × DI boxes', 'audio'], ['Bass amp: Ampeg SVT + 8×10', 'backline'], ['Guitar amp: Fender Twin Reverb', 'backline'], ['Hazer, no pyro', 'light'], ['Keyboard stands × 2', 'backline'], ['IEM × 4, band brings transmitters', 'audio'], ['Own LD at FOH, 2 m desk space', 'light']]
  const hosp: [string, Id][] = [['Hot meal for party, 1 vegan, 1 gluten-free', 'hosp'], ['24 × still water 0.5 l', 'hosp'], ['Fresh towels × 12', 'hosp'], ['Fruit platter', 'hosp'], ['Coffee machine in dressing room', 'hosp'], ['Local beer × 12', 'hosp'], ['Hot water, honey and lemon', 'hosp'], ['Lockable dressing room', 'site'], ['Runner with car from 14:00', 'transport']]
  const st: RiderStatus[] = ['sourced', 'agreed', 'requested', 'sourced', 'declined', 'requested', 'agreed']
  const pick = <T,>(arr: T[], n: number, off: number) => Array.from({ length: n }, (_, j) => arr[(j + off) % arr.length])
  Object.keys(col.artists).filter((_, i) => i % 2 === 0).forEach((a, i) => {
    const techItems: RiderItem[] = pick(tech, 4 + i % 4, i * 2).map(([text, dept], j) => ({ id: `t${j}`, text, dept, status: st[(i + j) % st.length], order: j }))
    const hospItems: RiderItem[] = pick(hosp, 3 + i % 4, i * 3).map(([text, dept], j) => ({ id: `h${j}`, text, dept, status: st[(i + j + 2) % st.length], order: j }))
    const byId = (items: RiderItem[]) => Object.fromEntries(items.map(x => [x.id, x]))
    col.riders[a + '_tech'] = { id: a + '_tech', artist: a, kind: 'tech', updated: t, items: byId(techItems) }
    col.riders[a + '_hosp'] = { id: a + '_hosp', artist: a, kind: 'hosp', updated: t, items: byId(hospItems) }
  })

  // clocks: festival-wide + one per stage
  col.clocks.c1 = { id: 'c1', label: 'Local time', kind: 'tod', tz, order: 0 }
  col.clocks.c2 = { id: 'c2', label: 'Main Stage curfew', kind: 'countdown', target: col.ros.cf0.start, warn: 15, order: 1 }
  STG.forEach((s, i) => { col.clocks['cs' + s.id] = { id: 'cs' + s.id, label: s.name, kind: 'stage', stage: s.id, scope: s.id, warn: 5, order: i } })
  col.clocks.ct = { id: 'ct', label: 'Changeover timer', kind: 'timer', scope: 'main', duration: 45 * MIN, accum: 0, runningSince: null, warn: 5, order: 9 }

  // messages
  col.msgs = {
    m1: { id: 'm1', from: 'demo-pm', to: { t: 'all' }, text: 'Weather: rain from 21:00. Cover FOH and monitor world on all outdoor stages.', pri: 'normal', at: t - 95 * MIN, acks: { 'demo-sm-main': t - 90 * MIN } },
    m2: { id: 'm2', from: 'demo-sm-main', to: { t: 'stage', id: 'main' }, text: 'Line check for the next act in 10. Wedges patched please.', pri: 'normal', at: t - 40 * MIN, acks: {} },
    m3: { id: 'm3', from: 'demo-al', to: { t: 'stage', id: 'tent' }, text: 'Next act on the Tent is stuck in traffic from the airport, ETA +25 min. Running order pushed 10 min, may need more.', pri: 'urgent', at: t - 18 * MIN, acks: { 'demo-pm': t - 15 * MIN } },
    m4: { id: 'm4', from: 'demo-hosp', to: { t: 'dept', id: 'al' }, text: 'Dressing rooms 3 and 4 at Fjord Stage are ready.', pri: 'normal', at: t - 9 * MIN, acks: {} },
    m5: { id: 'm5', from: 'demo-sm-fjord', to: { t: 'dept', id: 'transport' }, text: 'Need a runner at the Fjord Stage dock for a truck at 20:30.', pri: 'normal', at: t - 4 * MIN, acks: {} },
  }

  return { cfg, roles: { roles: structuredClone(DEFAULT_ROLES) }, col }
}
