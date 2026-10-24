// Checks showctrl's own sign-in end to end against `wrangler dev` (DEV_USER_EMAIL a superadmin,
// blank ACCESS_AUD in .dev.vars; codes come back as devCode there). Run: npm run check:login
const B = 'http://localhost:8787'
const t = Date.now()
const ip = { 'cf-connecting-ip': `test-${t}` }
const anon = { 'x-showctrl-anon': '1', ...ip }
const post = async (path, body, headers = {}) => {
  const r = await fetch(`${B}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...anon, ...headers }, body: JSON.stringify(body ?? {}) })
  return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get('set-cookie') }
}
const me = async (headers = {}) => { const r = await fetch(`${B}/api/me`, { headers: { ...anon, ...headers } }); return { status: r.status, body: await r.json().catch(() => null) } }
let ok = true
const check = (label, cond, got) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : `  → ${JSON.stringify(got)}`}`); if (!cond) ok = false }

// Known addresses: the admins of a new event (made as the dev superadmin).
const known = `admin${t}@test.no`, locked = `lock${t}@test.no`
const jpost = (path, b) => fetch(`${B}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
const { id: org } = await jpost('/api/orgs', { name: `Login test ${t}` })
await jpost('/api/events', { name: `Login test ${t}`, org, admins: [known, locked] })

let r = await me(); check('signed out: /api/me is 401', r.status === 401, r)
r = await post('/api/auth/start', { email: 'not-an-email' }); check('a bad address is refused', r.status === 400, r)
r = await post('/api/auth/start', { email: `stranger${t}@nowhere.no` }); check('an unknown address gets the same answer, but no code', r.status === 200 && r.body.ok && !r.body.devCode, r)
r = await post('/api/auth/start', { email: known.toUpperCase() }); check('a known address gets a code (case-insensitive)', r.status === 200 && /^\d{6}$/.test(r.body.devCode ?? ''), r)
const code = r.body.devCode
r = await post('/api/auth/start', { email: known }); check('asking again within a minute sends nothing new', r.status === 200 && !r.body.devCode, r)
const wrong = code === '000000' ? '111111' : '000000'
r = await post('/api/auth/verify', { email: known, code: wrong }); check('a wrong code is refused, with tries left', r.status === 400 && /4 tries left/.test(r.body.error), r)
r = await post('/api/auth/verify', { email: known, code: `${code.slice(0, 3)} ${code.slice(3)}` }); check('the right code signs in and sets an HttpOnly session cookie', r.status === 200 && /sc_session=[\w-]{20,}/.test(r.cookie ?? '') && /HttpOnly/i.test(r.cookie) && /SameSite=Lax/i.test(r.cookie), r)
const cookie = r.cookie.split(';')[0]
r = await me({ cookie }); check('the session cookie identifies the user', r.status === 200 && r.body.email === known && r.body.events?.length === 1, r)
r = await post('/api/auth/verify', { email: known, code }); check('a code works only once', r.status === 400, r)
r = await me({ cookie: 'sc_session=forged-token-value-123456789' }); check('a made-up session is refused', r.status === 401, r)
r = await post('/api/auth/logout', {}, { cookie }); check('log out clears the cookie', r.status === 200 && /Max-Age=0/.test(r.cookie ?? ''), r)
r = await me({ cookie }); check('after log out, the old cookie no longer works', r.status === 401, r)

r = await post('/api/auth/start', { email: locked }); const lcode = r.body.devCode
for (let i = 0; i < 5; i++) r = await post('/api/auth/verify', { email: locked, code: lcode === '000000' ? '111111' : '000000' })
check('the fifth wrong code locks it', /Too many wrong tries/.test(r.body?.error ?? ''), r)
r = await post('/api/auth/verify', { email: locked, code: lcode }); check('after that, even the right code is refused', r.status === 400, r)

console.log(ok ? '\nALL PASS' : '\nSOME FAILED'); process.exit(ok ? 0 : 1)
