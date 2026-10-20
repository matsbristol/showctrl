// Festival simulator for local development: makes a sample event behave like a live show day.
//
// It connects to `wrangler dev` as the sample festival's people (stage managers, production,
// hospitality, crew) and, in real time:
//   - takes run sheet items live and done as their times come, with realistic lateness and overruns,
//     shifting the rest of the day when a show starts late
//   - moves artists through travelling → arrived → backstage → ready → on stage → done
//   - starts and resets the Main Stage changeover timer around changeovers
//   - throws in incidents (delays with a reason and an urgent message to that stage)
//   - sends everyday messages, and acknowledges messages the way real crew do (most, not all, after a while)
//   - confirms hotel bookings, checks artists in, and sources rider items
//
// Every write goes through the normal server permission checks, as the persona doing it.
// Only works against `wrangler dev` (it signs in with ?as=, which production ignores).
//
//   node scripts/simulate.mjs                # create a fresh sample event and run it
//   node scripts/simulate.mjs --event <id>   # run an existing event
//   options: --base http://localhost:8787   --quiet

const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt }
const BASE = opt('base', 'http://localhost:8787')
const QUIET = args.includes('--quiet')
const MIN = 60_000

const rand = (a, b) => a + Math.random() * (b - a)
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const chance = p => Math.random() < p
/** Stable per-item randomness, so an item's lateness doesn't change between ticks. */
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
const hhmm = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' })
const log = (...a) => { if (!QUIET) console.log(`[${new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Oslo' })}]`, ...a) }

/* ---------------- event ---------------- */

async function api(path, init) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.json()
}

let eventId = opt('event')
if (!eventId) {
  eventId = (await api('/api/events', { method: 'POST', body: JSON.stringify({ name: 'Simulated festival', sample: true }) })).id
  await api('/api/me/last-event', { method: 'POST', body: JSON.stringify({ id: eventId }) })
  log(`Created a fresh sample event ${eventId} and made it the one that opens.`)
}

/* ---------------- connections ---------------- */

function connect(as) {
  const url = `${BASE.replace(/^http/, 'ws')}/api/events/${eventId}/ws${as ? `?as=${encodeURIComponent(as)}` : ''}`
  const sock = { as, ws: null, req: 0, ready: null, onSnapshot: null, onChanges: null }
  const open = () => new Promise(resolve => {
    const ws = new WebSocket(url)
    sock.ws = ws
    ws.onmessage = e => {
      const m = JSON.parse(e.data)
      if (m.t === 'snapshot') { sock.onSnapshot?.(m); resolve() }
      else if (m.t === 'changes') sock.onChanges?.(m)
      else if (m.t === 'error') log(`  ✗ ${as ?? 'owner'}: ${m.message}`)
    }
    ws.onclose = () => setTimeout(() => { sock.ready = open() }, 2000)
  })
  sock.ready = open()
  sock.send = op => { if (sock.ws?.readyState === 1) sock.ws.send(JSON.stringify({ t: 'op', req: ++sock.req, op })) }
  sock.update = (col, id, patch) => sock.send({ kind: 'update', col, id, patch })
  sock.set = (col, id, doc) => sock.send({ kind: 'set', col, id, doc })
  return sock
}

// The owner (admin) sees everything, so it's the simulator's view of the event.
const observer = connect(null)
const state = { col: {} }
observer.onSnapshot = m => { state.col = m.col; state.cfg = m.cfg }
observer.onChanges = m => {
  const c = (state.col[m.col] ??= {})
  for (const ch of m.changes) { if (ch.type === 'removed') delete c[ch.id]; else c[ch.id] = ch.doc }
  if (m.col === 'msgs') for (const ch of m.changes) if (ch.type === 'added') scheduleAcks(ch.doc)
}
await observer.ready

const STAGES = Object.keys(state.col.stages)
const sm = Object.fromEntries(STAGES.map(s => [s, connect(`demo-sm-${s}`)]))
const pm = connect('demo-pm')
const hosp = connect('demo-hosp')
const crew = Object.keys(state.col.members).filter(u => u.startsWith('demo-crew-')).map(u => connect(u))
await Promise.all([...Object.values(sm), pm, hosp, ...crew].map(s => s.ready))
log(`Connected as ${STAGES.length} stage managers, production, hospitality and ${crew.length} crew.`)

/* ---------------- run sheets ---------------- */

const eff = i => ({ s: i.start + (i.delay || 0), e: (i.end ?? i.start) + (i.delay || 0) })
const STAGE_TRACK = new Set(['access', 'soundcheck', 'linecheck', 'changeover', 'show', 'doors', 'curfew', 'other'])
const POINT = new Set(['access', 'doors', 'curfew'])
const requested = new Map() // id → status we asked for, so we don't send it twice
/** Items already under way when the simulator started are caught up quietly, not treated as late. */
const STARTED = Date.now()

/** How late an item really starts (and a show really ends), drawn once per item. */
const lateness = i => i.kind === 'show' ? Math.round((hash(i.id) ** 2) * 6) * MIN : Math.round(hash(i.id) * 2) * MIN
const overrun = i => i.kind === 'show' && hash(i.id + 'o') > 0.6 ? Math.round(hash(i.id + 'x') * 5) * MIN : 0

function today(stage, now) {
  return Object.values(state.col.ros ?? {}).filter(i => i.stage === stage && Math.abs(i.start - now) < 14 * 60 * MIN).sort((a, b) => eff(a).s - eff(b).s)
}

function shiftFrom(stage, item, ms, note) {
  for (const x of today(stage, item.start)) {
    if (x.start >= item.start && x.status !== 'done') sm[stage].update('ros', x.id, { delay: (x.delay || 0) + ms, ...(x.id === item.id ? { delayNote: note } : {}) })
  }
}

function setArtist(stage, artistId, status) {
  if (!status) return
  const a = state.col.artists?.[artistId]
  if (!a || a.status === status || a.status === 'cancelled') return
  const order = ['travelling', 'confirmed', 'arrived', 'backstage', 'ready', 'on stage', 'done']
  if (order.indexOf(status) <= order.indexOf(a.status) && status !== 'done') return
  sm[stage].update('artists', artistId, { status })
}

function driveRunSheets(now) {
  for (const stage of STAGES) {
    const items = today(stage, now)
    for (const i of items) {
      const { s, e } = eff(i)
      const want = requested.get(i.id)
      if (i.status === 'pending' && want !== 'live' && want !== 'done' && now >= s + lateness(i)) {
        if (POINT.has(i.kind)) { requested.set(i.id, 'done'); sm[stage].update('ros', i.id, { status: 'done', actual: now, actualEnd: now }); continue }
        requested.set(i.id, 'live')
        if (STAGE_TRACK.has(i.kind)) for (const x of items) if (x.status === 'live' && x.id !== i.id && STAGE_TRACK.has(x.kind)) sm[stage].update('ros', x.id, { status: 'done', actualEnd: now })
        sm[stage].update('ros', i.id, { status: 'live', actual: now })
        const catchUp = s < STARTED - MIN
        const late = catchUp ? 0 : Math.round((now - s) / MIN)
        if (!catchUp) log(`${state.col.stages[stage].name}: ${i.kind} ${i.title} ${late >= 2 ? `went on ${late} min late` : 'started'}`)
        if (i.kind === 'show' && late >= 2) shiftFrom(stage, items.find(x => x.start > i.start && x.status !== 'done') ?? i, late * MIN, 'Started late')
        if (i.artist) setArtist(stage, i.artist, { arrival: 'arrived', getin: 'backstage', loadin: 'backstage', changeover: 'ready', show: 'on stage' }[i.kind] ?? null)
        if (stage === 'main' && i.kind === 'changeover') sm.main.update('clocks', 'ct', { runningSince: now, accum: 0 })
        if (stage === 'main' && i.kind === 'show') sm.main.update('clocks', 'ct', { runningSince: null, accum: 0 })
      } else if (i.status === 'live' && want !== 'done' && now >= e + overrun(i)) {
        requested.set(i.id, 'done')
        sm[stage].update('ros', i.id, { status: 'done', actualEnd: now })
        if (i.kind === 'show') {
          const over = e < STARTED - MIN ? 0 : Math.round((now - e) / MIN)
          log(`${state.col.stages[stage].name}: ${i.title} off stage${over >= 2 ? `, overran ${over} min` : ''}`)
          if (i.artist) setArtist(stage, i.artist, 'done')
          if (over >= 2) { const nx = items.find(x => x.start > i.start && x.status !== 'done'); if (nx) shiftFrom(stage, nx, over * MIN, `${i.title} overran`) }
        }
      }
    }
  }
}

/* ---------------- incidents and messages ---------------- */

const INCIDENTS = [
  ['Power dropout on stage left, techs on it', 8, 12],
  ['Next act stuck in traffic from the airport', 10, 20],
  ['Barrier repair in the pit after the last set', 5, 10],
  ['Wind gusts above limit, holding the next changeover', 10, 15],
  ['Medical in the front rows, show paused', 5, 8],
  ['Backline amp failed at line check', 5, 10],
]
function incident(now) {
  const stage = pick(STAGES)
  const next = today(stage, now).find(i => i.kind === 'show' && i.status === 'pending' && eff(i).s > now)
  if (!next) return
  const [what, lo, hi] = pick(INCIDENTS)
  const mins = Math.round(rand(lo, hi))
  shiftFrom(stage, next, mins * MIN, what)
  sm[stage].set('msgs', `sim-${Date.now()}`, { from: `demo-sm-${stage}`, to: { t: 'stage', id: stage }, text: `${what}. Running order pushed ${mins} min from ${next.title}.`, pri: 'urgent', at: now, acks: {} })
  log(`⚠ ${state.col.stages[stage].name}: ${what} (+${mins} min)`)
}

const BROADCASTS = [
  'Weather update: showers expected within the hour. Cover FOH and monitor world on outdoor stages.',
  'Gate C queue is long, extra security staff on the way.',
  'Reminder: curfew on Main Stage is strict tonight. No encores past the planned end.',
  'Radio check on all channels in 5 minutes.',
  'Water stations 2 and 4 are refilled.',
  'Lost child reunited with parents at the info point. Thanks all.',
]
const STAGE_NOTES = ['Line check for the next act in 10. Wedges patched please.', 'Need two stagehands at the dock for the next truck.', 'Changeover going well, we are on time.', 'Drum riser moving in now, keep the stage-left wing clear.', 'Artist asks for a runner to the dressing room.', 'Monitor engineer needs batteries for IEMs.']
const HOSP_NOTES = ['Dressing rooms on Fjord Stage are ready.', 'Catering for the late acts served from 21:00.', 'Runner car back at the artist gate.', 'Extra towels delivered to Main Stage backstage.']

function chatter(now) {
  const r = Math.random()
  if (r < 0.25) pm.set('msgs', `sim-${Date.now()}`, { from: 'demo-pm', to: { t: 'all' }, text: pick(BROADCASTS), pri: chance(0.15) ? 'urgent' : 'normal', at: now, acks: {} })
  else if (r < 0.7) { const s = pick(STAGES); sm[s].set('msgs', `sim-${Date.now()}`, { from: `demo-sm-${s}`, to: { t: 'stage', id: s }, text: pick(STAGE_NOTES), pri: 'normal', at: now, acks: {} }) }
  else hosp.set('msgs', `sim-${Date.now()}`, { from: 'demo-hosp', to: { t: 'dept', id: 'al' }, text: pick(HOSP_NOTES), pri: 'normal', at: now, acks: {} })
}

/** Simulated people acknowledge messages meant for them, after a human-like pause. Some never do. */
function scheduleAcks(m) {
  const people = [...Object.entries(sm).map(([s, c]) => ({ c, stage: s, depts: ['stage'] })), { c: pm, depts: ['prod'] }, { c: hosp, depts: ['hosp'] },
    ...crew.map(c => ({ c, stage: c.as.split('-')[2], depts: [state.col.members[c.as]?.depts?.[0]] }))]
  for (const p of people) {
    if (p.c.as === m.from) continue
    const forThem = !m.to || m.to.t === 'all' || (m.to.t === 'stage' && m.to.id === p.stage) || (m.to.t === 'dept' && p.depts.includes(m.to.id)) || (m.to.t === 'user' && m.to.id === p.c.as)
    if (!forThem || !chance(m.pri === 'urgent' ? 0.9 : 0.6)) continue
    setTimeout(() => p.c.update('msgs', m.id, { acks: { [p.c.as]: Date.now() } }), rand(10, m.pri === 'urgent' ? 60 : 180) * 1000)
  }
}

/* ---------------- hospitality ---------------- */

function hospitality(now) {
  const bookings = Object.values(state.col.bookings ?? {})
  const req = bookings.filter(b => b.status === 'requested')
  if (req.length && chance(0.5)) { const b = pick(req); hosp.update('bookings', b.id, { status: 'confirmed' }); log(`Hospitality: booking confirmed for ${state.col.artists?.[b.artist]?.name ?? b.guest}`) }
  const arrived = bookings.filter(b => b.status === 'confirmed' && b.artist && ['arrived', 'backstage', 'ready', 'on stage', 'done'].includes(state.col.artists?.[b.artist]?.status))
  if (arrived.length) { const b = pick(arrived); hosp.update('bookings', b.id, { status: 'checked in' }); log(`Hospitality: ${state.col.artists[b.artist].name} checked in at ${state.col.hotels?.[b.hotel]?.name}`) }
  const riders = Object.values(state.col.riders ?? {}).filter(r => r.kind === 'hosp')
  for (const r of riders.sort(() => Math.random() - 0.5).slice(0, 2)) {
    const it = Object.values(r.items).find(x => x.status === 'requested' || x.status === 'agreed')
    if (it) hosp.update('riders', r.id, { items: { [it.id]: { status: it.status === 'requested' ? 'agreed' : 'sourced' } }, updated: now })
  }
}

/* ---------------- loop ---------------- */

let nextIncident = Date.now() + rand(2, 4) * MIN
let nextChatter = Date.now() + rand(20, 50) * 1000
let nextHosp = Date.now() + rand(30, 60) * 1000
log(`Running. Open ${BASE}/hq/overview — press Ctrl+C here to stop.`)
setInterval(() => {
  const now = Date.now()
  driveRunSheets(now)
  if (now >= nextIncident) { incident(now); nextIncident = now + rand(4, 8) * MIN }
  if (now >= nextChatter) { chatter(now); nextChatter = now + rand(40, 120) * 1000 }
  if (now >= nextHosp) { hospitality(now); nextHosp = now + rand(45, 90) * 1000 }
}, 5000)
