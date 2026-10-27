// Checks analytics end to end against `wrangler dev` (DEV_USER_EMAIL a superadmin; codes come
// back as devCode). Run: npm run check:analytics
const B = 'http://localhost:8787'
const t = Date.now()
let ok = true
const check = (label, cond, got) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  → ${JSON.stringify(got)}`}`); if (!cond) ok = false }
const req = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const r = await fetch(`${B}${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) })
  return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get('set-cookie') }
}
const anon = { 'x-showctrl-anon': '1', 'cf-connecting-ip': `an-${t}` }

// An event with one admin, who signs in with a code.
const user = `an${t}@test.no`
const { body: { id: org } } = await req('/api/orgs', { method: 'POST', body: { name: `Analytics ${t}` } })
const { body: ev } = await req('/api/events', { method: 'POST', body: { name: `Analytics ${t}`, org, admins: [{ email: user, name: 'Ana Lytics' }] } })
const { body: { devCode } } = await req('/api/auth/start', { method: 'POST', body: { email: user }, headers: anon })
const v = await req('/api/auth/verify', { method: 'POST', body: { email: user, code: devCode }, headers: { ...anon, 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } })
const as = { ...anon, cookie: v.cookie.split(';')[0] }

let r = await req('/api/activity', { method: 'POST', body: { event: ev.id, where: 'hq', view: 'schedule' }, headers: as }); check('a member reports a page', r.status === 200, r)
await req('/api/activity', { method: 'POST', body: { event: ev.id, where: 'hq', view: 'schedule' }, headers: as })
await req('/api/activity', { method: 'POST', body: { event: ev.id, where: 'stage', view: 'runsheet' }, headers: as })
r = await req('/api/activity', { method: 'POST', body: { event: ev.id, where: 'hq', view: 'nonsense' }, headers: as }); check('an unknown page is refused', r.status === 400, r)
const { body: other } = await req('/api/events', { method: 'POST', body: { name: `Other ${t}`, org, admins: [] } })
r = await req('/api/activity', { method: 'POST', body: { event: other.id, where: 'hq', view: 'schedule' }, headers: as }); check('not for events they don’t belong to', r.status === 404, r)
r = await req('/api/activity', { method: 'POST', body: { event: ev.id, where: 'hq', view: 'schedule' }, headers: anon }); check('not when signed out', r.status === 401, r)
r = await req('/api/analytics', { headers: as }); check('event admins can’t see analytics', r.status === 403, r)

r = await req('/api/analytics?days=7'); const a = r.body
check('superadmins can', r.status === 200 && a.days === 7, r)
const s = a.signins.find(x => x.email === user)
check('the sign-in is there, with how and on what', s?.method === 'code' && s?.device === 'iPhone · Safari', s)
const u = a.usage.filter(x => x.email === user)
check('page use is counted per page', u.find(x => x.view === 'hq/schedule')?.n === 2 && u.find(x => x.view === 'stage/runsheet')?.n === 1, u)
check('names come along', a.names[user] === 'Ana Lytics', a.names[user])
check('superadmins are listed so the page can hide them', a.superadmins.includes('mats@larkolluka.no'), a.superadmins)
check('events are listed with their customer', a.events.some(e => e.id === ev.id && e.org === `Analytics ${t}`), null)

console.log(ok ? '\nALL PASS' : '\nSOME FAILED'); process.exit(ok ? 0 : 1)
