// Creates "Larkolluka 2026" as its own event on `wrangler dev`, separate from any demo event.
//
// Programme from public listings (moss-avis.no, konserterinorge.no, ticketmaster.no,
// visitoestfold.com). Where listings disagreed, the most specific source was used:
// set times for the family concert and Friday are Moss Avis; Tuesday's running order
// and Astrid S's day weren't published, so those are placeholders to adjust in the app.
//
// The festival week is placed so day 1 is today (keeping each day's times), so clocks,
// countdowns and the run sheet are live. Pass --real-dates to use 12–18 July 2026.
//
//   node scripts/seed-larkolluka.mjs [--real-dates] [--base http://localhost:8787]

const args = process.argv.slice(2)
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:8787'
const REAL = args.includes('--real-dates')
const TZ = 'Europe/Oslo'
const MIN = 60_000

/* ---------- dates in Oslo time ---------- */
function osloOffset(utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(utcMs).map(x => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000
}
const at = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const g = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), h, m); return g - osloOffset(g - osloOffset(g)) }
const addDays = (d, n) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10)
const todayOslo = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const START = REAL ? '2026-07-12' : todayOslo()
const day = n => addDays(START, n)
const rid = () => Math.random().toString(36).slice(2, 10)

/* ---------- the festival ---------- */
const stages = [
  { id: 'parklane', name: 'Park Lane', tape: 'red', order: 0, location: 'Larkollen sentrum', radio: 'Ch 1' },
  { id: 'plassen', name: 'Festivalplassen', tape: 'yellow', order: 1, location: 'Larkollen sentrum', radio: 'Ch 2' },
  { id: 'kirka', name: 'Larkollen kirke', tape: 'purple', order: 2, location: 'Larkollen kirke', radio: 'Ch 3' },
  { id: 'molo', name: 'Støtvigmoloen', tape: 'teal', order: 3, location: 'Støtvigmoloen', radio: 'Ch 4' },
]

// [day index, stage, artist, on stage, minutes, genre, note]
const shows = [
  [2, 'parklane', '06 Boys', '19:00', 60, 'Hip-hop', 'Tirsdagskonsert 18+. Running order not published: adjust.'],
  [2, 'parklane', 'GOLF', '20:30', 60, 'Pop', 'Tirsdagskonsert 18+. Running order not published: adjust.'],
  [2, 'parklane', 'Stig Brenner', '22:00', 75, 'Pop', 'Tirsdagskonsert 18+. Running order not published: adjust.'],
  [2, 'kirka', 'Ensemble Forte', '19:00', 75, 'Klassisk', 'Klassisk aften'],
  [3, 'parklane', 'eMMa', '18:30', 60, 'Pop', 'Familiekonsert'],
  [3, 'parklane', 'Ylva', '20:00', 60, 'Pop', 'Familiekonsert'],
  [3, 'parklane', 'Ramón', '21:45', 75, 'Pop', 'Familiekonsert'],
  [4, 'parklane', 'Astrid S', '20:30', 75, 'Pop', 'Day not confirmed in listings (Wednesday or Thursday): check.'],
  [5, 'parklane', 'Postgirobygget', '20:15', 75, 'Rock', '18+'],
  [5, 'parklane', 'Madcon', '22:30', 75, 'Hip-hop', '18+'],
]

// Other programme items: [day, stage, kind, title, start, end?, note]
const events = [
  [0, 'plassen', 'other', 'Karnevalstog fra Joker Thorvaldsen', '12:00', '13:00', 'Ends at Park Lane'],
  [0, 'parklane', 'doors', 'Musikk på Park Lane', '19:00', null, ''],
  [1, 'parklane', 'other', 'Familiekino: Flåklypa', '17:00', '18:30', 'Utekino'],
  [1, 'molo', 'other', 'Fiskekonkurranse', '19:00', '21:00', 'Fra Støtvigmoloen'],
  [1, 'parklane', 'other', 'Utekino: Forrest Gump', '21:30', '23:55', ''],
  [2, 'plassen', 'other', 'Morgentrim', '10:00', '10:45', ''],
  [2, 'parklane', 'doors', 'Dørene åpner (18+)', '18:00', null, ''],
  [2, 'parklane', 'curfew', 'Stengetid', '23:30', null, ''],
  [3, 'plassen', 'other', 'Morgentrim', '10:00', '10:45', ''],
  [3, 'parklane', 'doors', 'Dørene åpner (familiekonsert)', '17:00', null, 'Ingen aldersgrense'],
  [3, 'parklane', 'curfew', 'Stengetid', '23:15', null, ''],
  [4, 'parklane', 'other', 'Silent Disco', '22:00', '23:59', ''],
  [5, 'plassen', 'other', 'Barneklasse', '14:00', '15:00', ''],
  [5, 'parklane', 'doors', 'Dørene åpner (18+)', '18:00', null, ''],
  [5, 'parklane', 'curfew', 'Stengetid', '00:00', null, 'Midnight'],
]

/* ---------- build ---------- */
const TPL = { arrival: -240, getin: -180, loadin: -120, loadinDur: 45, access: -45, changeover: 30, loadoutAfter: 15, loadoutDur: 45, departure: 150, soundcheckDur: 45 }
const artists = []
const ros = []
for (const [d, stage, name, time, len, genre, note] of shows) {
  const id = `ll-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  artists.push({ id, name, stage, status: 'confirmed', genre, notes: note, contacts: [] })
  const s = at(day(d), time), e = s + len * MIN, m = n => n * MIN
  const mk = (kind, a, b, title = name) => ({ id: `${id}-${kind}`, stage, artist: id, kind, title, start: a, end: b, status: 'pending', delay: 0, notes: '' })
  ros.push(
    mk('arrival', s + m(TPL.arrival), s + m(TPL.arrival + 15)), mk('getin', s + m(TPL.getin), s + m(TPL.getin + 15)),
    mk('loadin', s + m(TPL.loadin), s + m(TPL.loadin + TPL.loadinDur)), mk('access', s + m(TPL.access), s + m(TPL.access)),
    mk('changeover', s - m(TPL.changeover), s, `Changeover → ${name}`), mk('show', s, e),
    mk('loadout', e + m(TPL.loadoutAfter), e + m(TPL.loadoutAfter + TPL.loadoutDur)), mk('departure', e + m(TPL.departure), e + m(TPL.departure + 15)),
  )
}
for (const [d, stage, kind, title, start, end, notes] of events) {
  const s = at(day(d), start)
  // A curfew at "00:00" belongs to the night of that festival day.
  const s2 = start === '00:00' ? at(day(d + 1), start) : s
  ros.push({ id: `ll-ev-${rid()}`, stage, artist: null, kind, title, start: s2, end: end ? at(day(d), end) : s2, status: 'pending', delay: 0, notes })
}

const clocks = [
  { id: 'c-local', label: 'Lokal tid', kind: 'tod', tz: TZ, scope: null, order: 0 },
  { id: 'c-parklane', label: 'Park Lane', kind: 'stage', stage: 'parklane', scope: 'parklane', warn: 5, order: 1 },
  { id: 'c-changeover', label: 'Changeover', kind: 'timer', scope: 'parklane', duration: 30 * MIN, accum: 0, runningSince: null, warn: 5, order: 2 },
]
const screens = [
  { id: 'scr-office', name: 'Produksjonskontor', scope: null, stages: [], blocks: ['clock', 'nownext', 'schedule', 'messages'], order: 0 },
  { id: 'scr-foh', name: 'FOH Park Lane', scope: 'parklane', stages: ['parklane'], blocks: ['clock', 'nownext', 'schedule'], order: 1 },
]

/* ---------- send ---------- */
const api = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.json()
}
const { id: eventId } = await api('/api/events', { name: 'Larkolluka 2026', sample: false })
const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/events/${eventId}/ws`)
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

const cfg = { ...snapshot.cfg, name: 'Larkolluka 2026', start: START, end: day(6), tz: TZ, visitors: null }
await send({ kind: 'setConfig', which: 'event', doc: cfg })
// The blank event comes with no stages; replace nothing else.
await send({ kind: 'setMany', col: 'stages', docs: stages.map(s => ({ ...s, template: TPL })) })
await send({ kind: 'setMany', col: 'artists', docs: artists })
for (let i = 0; i < ros.length; i += 200) await send({ kind: 'setMany', col: 'ros', docs: ros.slice(i, i + 200) })
await send({ kind: 'setMany', col: 'clocks', docs: clocks })
await send({ kind: 'setMany', col: 'screens', docs: screens })
await api('/api/me/last-event', { id: eventId })
ws.close()

console.log(`Larkolluka 2026 created: ${eventId}`)
console.log(`${stages.length} stages, ${artists.length} artists, ${ros.length} run sheet items, ${REAL ? '12–18 July 2026' : `days from ${START}`}`)
console.log(`Open ${BASE}/hq/overview (it's now the event that opens; switch with Events)`)
process.exit(0)
