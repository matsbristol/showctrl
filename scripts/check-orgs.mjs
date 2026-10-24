// Checks organisation isolation end to end against `wrangler dev` (needs DEV_USER_EMAIL as a superadmin
// and blank ACCESS_AUD in .dev.vars). Run: npm run check:orgs
const B = 'http://localhost:8787'
const as = who => (who ? `?as=${encodeURIComponent(who)}` : '')
const call = async (who, method, path, body) => {
  const r = await fetch(`${B}${path}${as(who)}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const ws = (who, id) => new Promise(res => {
  const s = new WebSocket(`ws://localhost:8787/api/events/${id}/ws${as(who)}`)
  const t = setTimeout(() => { res({ result: 'timeout' }); s.close() }, 4000)
  s.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'snapshot') { clearTimeout(t); res({ result: 'snapshot', role: m.col?.members?.[who]?.role ?? null, artists: Object.keys(m.col?.artists ?? {}).length }); s.close() } }
  s.onerror = () => { clearTimeout(t); res({ result: 'refused' }) }
})
let ok = true
const check = (label, cond, got) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  → ${JSON.stringify(got)}`}`); if (!cond) ok = false }
const t = Date.now()
const kari = `kari${t}@acme.no`, per = `per${t}@acme.no`, ola = `ola${t}@other.no`, mats = null

let r = await call(mats, 'GET', '/api/me'); check('superadmin flag for Mats', r.body?.superadmin === true, r.body)
r = await call(kari, 'POST', '/api/orgs', { name: 'Nope' }); check('non-superadmin cannot add an organisation', r.status === 403, r)
r = await call(mats, 'POST', '/api/orgs', { name: `Acme ${t}`, admins: [kari] }); check('Mats adds Acme with Kari as admin', r.status === 201, r); const acme = r.body.id
r = await call(mats, 'POST', '/api/orgs', { name: `Other ${t}`, admins: [ola] }); const other = r.body.id
r = await call(kari, 'POST', '/api/events', { name: 'Acme Fest', org: other }); check('Kari cannot create an event in another organisation', r.status === 403, r)
r = await call(kari, 'POST', '/api/events', { name: 'Acme Fest', sample: true, org: acme }); check('Kari creates an event in Acme', r.status === 201, r); const fest = r.body.id
r = await call(ola, 'POST', '/api/events', { name: 'Other Fest', org: other }); const ofest = r.body.id
r = await call(kari, 'GET', '/api/me'); check('Kari sees Acme and its event only', r.body.orgs.length === 1 && r.body.orgs[0].admin && r.body.events.map(e => e.id).join() === fest, r.body)
r = await call(ola, 'GET', '/api/me'); check('Ola sees only Other', r.body.orgs.map(o => o.id).join() === other && r.body.events.map(e => e.id).join() === ofest, r.body)
r = await call(`nobody${t}@x.no`, 'GET', '/api/me'); check('Someone with no organisation sees nothing', r.body.orgs.length === 0 && r.body.events.length === 0, r.body)
check('Ola cannot connect to Acme Fest', (await ws(ola, fest)).result === 'refused')
let w = await ws(kari, fest); check('Kari connects to Acme Fest as admin', w.result === 'snapshot' && w.role === 'admin' && w.artists > 0, w)
r = await call(ola, 'GET', `/api/orgs/${acme}`); check('Ola cannot read Acme', r.status === 404, r)
r = await call(kari, 'POST', `/api/orgs/${acme}/admins`, { email: per }); check('Kari adds Per as admin', r.status === 200 && r.body.admins.includes(per), r)
w = await ws(per, fest); check('Per is now admin in Acme Fest', w.result === 'snapshot' && w.role === 'admin', w)
r = await call(per, 'GET', '/api/me'); check('Per sees Acme Fest', r.body.events.some(e => e.id === fest), r.body)
r = await call(kari, 'DELETE', `/api/orgs/${acme}/admins/${encodeURIComponent(per)}`); check('Kari removes Per', r.status === 200 && !r.body.admins.includes(per), r)
await new Promise(res => setTimeout(res, 500))
check('Per can no longer connect to Acme Fest', (await ws(per, fest)).result === 'refused')
r = await call(kari, 'DELETE', `/api/orgs/${acme}/admins/${encodeURIComponent(kari)}`); check('The last admin cannot be removed', r.status === 400, r)
r = await call(kari, 'PATCH', `/api/orgs/${acme}`, { name: `Acme AS ${t}` }); check('Kari renames Acme', r.status === 200, r)
r = await call(mats, 'GET', '/api/me'); check('Mats (superadmin) sees both organisations', [acme, other].every(id => r.body.orgs.some(o => o.id === id)), r.body.orgs)
console.log(ok ? '\nALL PASS' : '\nSOME FAILED'); process.exit(ok ? 0 : 1)
