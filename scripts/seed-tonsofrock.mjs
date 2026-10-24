// Creates "Tons of Rock 2026" (Ekebergsletta, Oslo, 24–27 June 2026) as its own event,
// under the customer "Tons of Rock", on a showctrl Worker. Needs a superadmin.
//
// Set times: the Clashfinder grid (clashfinder.com/m/tons2026, last edited 20 June 2026),
// with the later changes from the festival and konserterinorge.no:
//   - The Hellacopters replaced Tom Morello (family reasons), Friday 15:05 on Scream.
//   - Joan Jett & The Blackhearts played Friday's 19:30 Scream headline slot (listed for YUNGBLUD).
// Music acts get a full day sheet from the standard template; Storm-stage comedy and talks get
// the show only. Karaoke, silent disco and the football screening are other programme items.
//
//   node scripts/seed-tonsofrock.mjs --base https://showctrl.no --cookie "sc_session=…" [--today]
//   node scripts/seed-tonsofrock.mjs                      (wrangler dev, as DEV_USER_EMAIL)
// --today moves the festival so day 1 is today (same times), to see it live.

const args = process.argv.slice(2)
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const BASE = opt('--base') ?? 'http://localhost:8787'
const COOKIE = opt('--cookie')
const TZ = 'Europe/Oslo'
const MIN = 60_000

/* ---------- dates in Oslo time ---------- */
function osloOffset(utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(utcMs).map(x => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000
}
const at = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const g = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m); return g - osloOffset(g - osloOffset(g)) }
const addDays = (d, n) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10)
const START = args.includes('--today') ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) : '2026-06-24'
const day = n => addDays(START, n)

/* ---------- the festival ---------- */
const stages = [
  { id: 'scream', name: 'Scream', tape: 'red', order: 0, location: 'Ekebergsletta', radio: 'Ch 1', capacity: 30000 },
  { id: 'vampire', name: 'Vampire', tape: 'purple', order: 1, location: 'Ekebergsletta', radio: 'Ch 2' },
  { id: 'moonlight', name: 'Moonlight', tape: 'blue', order: 2, location: 'Ekebergsletta', radio: 'Ch 3' },
  { id: 'storm', name: 'Storm', tape: 'teal', order: 3, location: 'Ekebergsletta (tent)', radio: 'Ch 4' },
]

// day (0 = Wed 24 June) | stage | start | end | name | kind: show (default), talk (Storm: show only), other (no artist)
const GRID = `
0|scream|14:00|14:50|Black Debbath
0|scream|15:55|16:55|Trivium
0|scream|18:15|19:25|Dumdum Boys
0|scream|21:25|22:55|Bring Me The Horizon
1|scream|13:50|14:35|Apocalyptica
1|scream|15:45|16:35|D-A-D
1|scream|17:55|18:55|Anthrax
1|scream|20:45|22:55|Iron Maiden
2|scream|13:20|14:10|Raga Rockers
2|scream|15:05|16:05|The Hellacopters|Replaced Tom Morello, who cancelled for family reasons.
2|scream|17:10|18:20|The Hives
2|scream|19:30|20:50|Joan Jett & The Blackhearts|Headline slot first listed for YUNGBLUD.
2|scream|21:00|23:00|Norway vs France (football on the big screen)||other
3|scream|14:00|14:50|DDR
3|scream|16:10|17:10|Sepultura|Billed as their last show in Norway.
3|scream|18:40|19:55|Accept
3|scream|21:25|22:55|Limp Bizkit
0|vampire|14:55|15:45|Cavalera
0|vampire|17:05|18:05|Babymetal
0|vampire|19:40|21:10|The Offspring
1|vampire|13:00|13:45|Audrey Horne
1|vampire|14:45|15:35|Imminence
1|vampire|16:45|17:45|Suicidal Tendencies
1|vampire|19:10|20:25|Alice Cooper
2|vampire|12:30|13:20|Eivør
2|vampire|14:10|15:00|Queensrÿche
2|vampire|16:10|17:05|Avatar
2|vampire|18:25|19:25|Behemoth
2|vampire|21:30|22:30|Rival Sons
3|vampire|13:00|13:50|Pain
3|vampire|15:05|15:55|Black Label Society
3|vampire|17:25|18:25|Leprous
3|vampire|20:05|21:15|A Perfect Circle
0|moonlight|14:10|14:55|Die Spitz
0|moonlight|15:25|16:10|President
0|moonlight|16:45|17:35|The Carburetors
0|moonlight|18:55|19:45|Blood Incantation
0|moonlight|20:20|21:20|BFD (Bathory)|Bathory tribute.
1|moonlight|13:15|14:00|The Baboon Show
1|moonlight|14:35|15:20|Grandson
1|moonlight|16:05|16:55|Yonaka
1|moonlight|17:40|18:30|The Warning
1|moonlight|19:20|20:20|Paleface Swiss
2|moonlight|13:00|13:40|The Funeral Portrait
2|moonlight|14:10|14:55|Kublai Khan TX
2|moonlight|15:25|16:10|Storm
2|moonlight|16:45|17:35|Dogstar
2|moonlight|18:10|19:00|Elder
2|moonlight|19:40|20:50|Mayhem
2|moonlight|21:40|22:30|Possessed
3|moonlight|13:00|13:40|Ego Kill Talent
3|moonlight|14:10|14:55|Slay Squad
3|moonlight|15:25|16:10|Gaerea
3|moonlight|16:45|17:35|Gatecreeper
3|moonlight|18:55|19:45|Blood Red Throne
3|moonlight|20:15|21:15|Death To All
0|storm|14:20|14:50|Martin Bever-Olsen||talk
0|storm|16:00|16:30|Turdus Musicus||talk
0|storm|18:10|18:40|Cecille Moroni||talk
0|storm|19:10|19:40|Jordsjuk||talk
1|storm|14:00|14:30|Sarah Løvald||talk
1|storm|15:35|16:05|Angell||talk
1|storm|17:45|18:15|Paul Myrehaug||talk
1|storm|18:40|19:10|Ramona's Tea Party|Band competition slot.
2|storm|15:00|15:30|Mørk Medisin – Dag Sørås & Esben Abrahamsen||talk
2|storm|17:10|17:40|Høst||talk
2|storm|18:10|18:40|Nora Svenningsen||talk
2|storm|19:10|19:40|Koco Franco||talk
3|storm|14:00|14:30|Javad El Bakali||talk
3|storm|16:00|16:30|You Know Who||talk
3|storm|18:25|18:55|Bill Bailey||talk
3|storm|19:30|20:00|Baphy||talk
`
// Every night on Storm.
const NIGHTLY = [0, 1, 2, 3].flatMap(d => [`${d}|storm|21:30|22:15|Karaoke From Hell||other`, `${d}|storm|22:30|23:30|Silent Headbanging||other`])

/* ---------- build ---------- */
const TPL = { arrival: -240, getin: -180, loadin: -120, loadinDur: 45, access: -45, changeover: 30, loadoutAfter: 15, loadoutDur: 45, departure: 150, soundcheckDur: 45 }
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const artists = []
const ros = []
for (const line of [...GRID.trim().split('\n'), ...NIGHTLY]) {
  const [d, stage, s0, e0, name, note = '', kind = 'show'] = line.split('|')
  const s = at(day(+d), s0), e = at(day(+d), e0)
  if (kind === 'other') {
    ros.push({ id: `tor-ev-${d}-${stage}-${s0.replace(':', '')}`, stage, artist: null, kind: 'other', title: name, start: s, end: e, status: 'pending', delay: 0, notes: note })
    continue
  }
  const id = `tor-${slug(name)}`
  artists.push({ id, name, stage, status: 'confirmed', genre: kind === 'talk' ? 'Comedy & talk' : '', notes: note, contacts: [] })
  const m = n => n * MIN
  const mk = (k, a, b, title = name) => ({ id: `${id}-${k}`, stage, artist: id, kind: k, title, start: a, end: b, status: 'pending', delay: 0, notes: '' })
  if (kind === 'talk') { ros.push(mk('show', s, e)); continue }
  ros.push(
    mk('arrival', s + m(TPL.arrival), s + m(TPL.arrival + 15)), mk('getin', s + m(TPL.getin), s + m(TPL.getin + 15)),
    mk('loadin', s + m(TPL.loadin), s + m(TPL.loadin + TPL.loadinDur)), mk('access', s + m(TPL.access), s + m(TPL.access)),
    mk('changeover', s - m(TPL.changeover), s, `Changeover → ${name}`), mk('show', s, e),
    mk('loadout', e + m(TPL.loadoutAfter), e + m(TPL.loadoutAfter + TPL.loadoutDur)), mk('departure', e + m(TPL.departure), e + m(TPL.departure + 15)),
  )
}

const clocks = [
  { id: 'c-local', label: 'Oslo', kind: 'tod', tz: TZ, scope: null, order: 0 },
  ...stages.slice(0, 3).map((s, i) => ({ id: `c-${s.id}`, label: s.name, kind: 'stage', stage: s.id, scope: s.id, warn: 5, order: i + 1 })),
]
const screens = [
  { id: 'scr-prod', name: 'Production office', scope: null, stages: [], blocks: ['clock', 'nownext', 'schedule', 'messages'], order: 0 },
  ...stages.slice(0, 3).map((s, i) => ({ id: `scr-${s.id}`, name: `${s.name} side stage`, scope: s.id, stages: [s.id], blocks: ['clock', 'nownext', 'schedule'], order: i + 1 })),
]

/* ---------- send ---------- */
const headers = COOKIE ? { cookie: COOKIE } : {}
const api = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) } : { headers })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.json()
}
const me = await api('/api/me')
if (!me.superadmin) throw new Error(`${me.email} is not a superadmin.`)
const org = me.orgs.find(o => o.name === 'Tons of Rock')?.id ?? (await api('/api/orgs', { name: 'Tons of Rock' })).id
const { id: eventId } = await api('/api/events', { name: 'Tons of Rock 2026', sample: false, org, admins: [] })
const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/events/${eventId}/ws`, { headers })
const inbox = new Map()
let snapshot
await new Promise((resolve, reject) => {
  ws.onerror = reject
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.t === 'snapshot') { snapshot = m; resolve() }
    if (m.req) inbox.get(m.req)?.(m)
  }
})
let req = 0
const send = op => new Promise((resolve, reject) => {
  const id = ++req
  inbox.set(id, m => (m.t === 'error' ? reject(new Error(m.message)) : resolve(m)))
  ws.send(JSON.stringify({ t: 'op', req: id, op }))
})
await send({ kind: 'setConfig', which: 'event', doc: { ...snapshot.cfg, name: 'Tons of Rock 2026', start: day(0), end: day(3), tz: TZ, visitors: 30000 } })
await send({ kind: 'setMany', col: 'stages', docs: stages.map(s => ({ ...s, template: TPL })) })
await send({ kind: 'setMany', col: 'artists', docs: artists })
for (let i = 0; i < ros.length; i += 200) await send({ kind: 'setMany', col: 'ros', docs: ros.slice(i, i + 200) })
await send({ kind: 'setMany', col: 'clocks', docs: clocks })
await send({ kind: 'setMany', col: 'screens', docs: screens })
ws.close()

console.log(`Tons of Rock 2026 created: ${eventId}`)
console.log(`${stages.length} stages, ${artists.length} acts, ${ros.length} run sheet items, from ${day(0)}`)
process.exit(0)
