// Checks who sees what, end to end against `wrangler dev` (DEV_USER_EMAIL a superadmin, blank
// ACCESS_AUD in .dev.vars, and a second superadmin in SUPERADMINS). Run: npm run check:access
//
// Superadmins run the whole portfolio; event admins run only their own events; nobody else gets in.
const B = 'http://localhost:8787'
const SUPER2 = 'mats.bristol@gmail.com'
const as = who => (who ? `?as=${encodeURIComponent(who)}` : '')
const call = async (who, method, path, body) => {
  const r = await fetch(`${B}${path}${as(who)}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const ws = (who, id) => new Promise(res => {
  const s = new WebSocket(`ws://localhost:8787/api/events/${id}/ws${as(who)}`)
  const t = setTimeout(() => { res({ result: 'timeout' }); s.close() }, 4000)
  s.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'snapshot') { clearTimeout(t); res({ result: 'snapshot', isOwner: m.isOwner, role: m.col?.members?.[who]?.role ?? null, artists: Object.keys(m.col?.artists ?? {}).length }); s.close() } }
  s.onerror = () => { clearTimeout(t); res({ result: 'refused' }) }
})
let ok = true
const check = (label, cond, got) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  → ${JSON.stringify(got)}`}`); if (!cond) ok = false }
const t = Date.now()
const kari = `kari${t}@acme.no`, per = `per${t}@acme.no`, ola = `ola${t}@other.no`, boss = null

let r = await call(boss, 'GET', '/api/me'); check('the dev user is a superadmin', r.body?.superadmin === true && r.body.canCreate, r.body)
r = await call(kari, 'POST', '/api/orgs', { name: 'Nope' }); check('others cannot add customers', r.status === 403, r)
r = await call(boss, 'POST', '/api/orgs', { name: `Acme ${t}` }); check('a superadmin adds a customer', r.status === 201, r); const acme = r.body.id
r = await call(boss, 'POST', '/api/orgs', { name: `Other ${t}` }); const other = r.body.id
r = await call(kari, 'POST', '/api/events', { name: 'x', org: acme, admins: [] }); check('others cannot create events', r.status === 403, r)
r = await call(boss, 'POST', '/api/events', { name: 'Acme Fest', sample: true, org: acme, admins: [kari] }); check('a superadmin creates an event with Kari as its admin', r.status === 201, r); const fest = r.body.id
r = await call(boss, 'POST', '/api/events', { name: 'Acme Winter', org: acme, admins: [] }); const winter = r.body.id
r = await call(boss, 'POST', '/api/events', { name: 'Other Fest', org: other, admins: [ola] }); const ofest = r.body.id
r = await call(kari, 'GET', '/api/me'); check('Kari sees only her own event, and can’t create any', r.body.events.map(e => e.id).join() === fest && !r.body.canCreate && !r.body.superadmin, r.body)
r = await call(ola, 'GET', '/api/me'); check('Ola sees only Other Fest', r.body.events.map(e => e.id).join() === ofest, r.body)
r = await call(`nobody${t}@x.no`, 'GET', '/api/me'); check('someone in no event sees nothing', r.body.events.length === 0 && r.body.orgs.length === 0, r.body)
let w = await ws(kari, fest); check('Kari is admin in Acme Fest', w.result === 'snapshot' && w.role === 'admin' && w.artists > 0, w)
check('Kari cannot open Acme Winter (same customer, not her event)', (await ws(kari, winter)).result === 'refused')
check('Ola cannot open Acme Fest', (await ws(ola, fest)).result === 'refused')
r = await call(kari, 'GET', `/api/events/${fest}/admins`); check('an event admin cannot manage event admins from the start page', r.status === 403, r)
r = await call(boss, 'POST', `/api/events/${fest}/admins`, { email: per }); check('a superadmin appoints Per', r.status === 200 && r.body.admins.includes(per), r)
w = await ws(per, fest); check('Per is now admin in Acme Fest', w.result === 'snapshot' && w.role === 'admin', w)
r = await call(boss, 'DELETE', `/api/events/${fest}/admins/${encodeURIComponent(per)}`); check('a superadmin removes Per', r.status === 200 && !r.body.admins.includes(per), r)
await new Promise(res => setTimeout(res, 500))
check('Per can no longer open Acme Fest', (await ws(per, fest)).result === 'refused')
r = await call(boss, 'GET', '/api/me'); const owner = r.body.email
r = await call(boss, 'DELETE', `/api/events/${fest}/admins/${encodeURIComponent(owner)}`); check('the event’s creator cannot be removed', r.status === 400, r)
w = await ws(SUPER2, fest); check('another superadmin is admin in every event without being added', w.result === 'snapshot' && w.isOwner && w.artists > 0, w)
r = await call(SUPER2, 'GET', '/api/me'); check('…and sees the whole portfolio', [fest, winter, ofest].every(id => r.body.events.some(e => e.id === id)), r.body.events.length)
console.log(ok ? '\nALL PASS' : '\nSOME FAILED'); process.exit(ok ? 0 : 1)
