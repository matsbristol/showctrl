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
const known = `admin${t}@test.no`, locked = `lock${t}@test.no`, third = `third${t}@test.no`
const jpost = (path, b) => fetch(`${B}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
const { id: org } = await jpost('/api/orgs', { name: `Login test ${t}` })
await jpost('/api/events', { name: `Login test ${t}`, org, admins: [known, locked, third] })

let r = await me(); check('signed out: /api/me is 401', r.status === 401, r)
r = await post('/api/auth/start', { email: 'not-an-email' }); check('a bad address is refused', r.status === 400, r)
r = await post('/api/auth/start', { email: `stranger${t}@nowhere.no` }); check('an unknown address gets the same answer, but no code', r.status === 200 && r.body.ok && !r.body.devCode && /sc_browser=/.test(r.cookie ?? ''), r)
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

// Sign-in links: superadmins only, reusable for 30 days, a new one or Cancel stops the old one.
const jdo = (path, b, method = 'POST', headers = {}) => fetch(`${B}${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(b) }).then(async x => ({ status: x.status, body: await x.json().catch(() => null) }))
r = await jdo('/api/admin/signin-link', { email: known }); check('a superadmin makes a sign-in link (token after #)', r.status === 200 && /\/#signin=[\w-]{20,}$/.test(r.body?.url ?? ''), r)
const tok = r.body.url.split('#signin=')[1]
r = await post('/api/auth/link', { token: tok }); check('the link signs in', r.status === 200 && r.body.email === known && /sc_session=/.test(r.cookie ?? ''), r)
r = await me({ cookie: r.cookie.split(';')[0] }); check('as the person it was made for', r.status === 200 && r.body.email === known, r)
r = await post('/api/auth/link', { token: tok }); check('and works again (reusable)', r.status === 200, r)
r = await jdo('/api/admin/signin-link', { email: known }, 'POST', { 'x-showctrl-anon': '1' }); check('signed out, nobody can make one', r.status === 401, r)
r = await jdo('/api/admin/signin-link?as=' + encodeURIComponent(known), { email: locked }); check('an event admin can’t make one', r.status === 403, r)
r = await jdo('/api/admin/signin-link', { email: `stranger${t}@nowhere.no` }); check('not for unknown addresses', r.status === 400, r)
r = await jdo('/api/admin/signin-link', { email: 'mats@larkolluka.no' }); check('not for superadmins', r.status === 400, r)
const tok2 = (await jdo('/api/admin/signin-link', { email: known })).body.url.split('#signin=')[1]
r = await post('/api/auth/link', { token: tok }); check('a new link stops the old one', r.status === 400, r)
r = await post('/api/auth/link', { token: tok2 }); check('and the new one works', r.status === 200, r)
await jdo('/api/admin/signin-link', { email: known }, 'DELETE')
r = await post('/api/auth/link', { token: tok2 }); check('Cancel stops it', r.status === 400, r)
r = await post('/api/auth/link', { token: 'made-up-token-123456789' }); check('a made-up link is refused', r.status === 400, r)

// The link in the sign-in email: once, together with its code. It signs in by itself only in the
// browser that asked for the code; anywhere else (a phone, a mail scanner) it waits for a press.
r = await post('/api/auth/start', { email: locked })
check('asking for a code marks the browser (HttpOnly, only for /api/auth)', /sc_browser=[\w-]{40,}/.test(r.cookie ?? '') && /Path=\/api\/auth;/.test(r.cookie) && /HttpOnly/i.test(r.cookie), r)
const browser = r.cookie.split(';')[0]
check('the sign-in email has a link (token after #login=)', /\/#login=[\w-]{20,}$/.test(r.body?.devLink ?? ''), r)
const mtok = r.body.devLink.split('#login=')[1], mcode = r.body.devCode
r = await post('/api/auth/magic', { token: mtok, auto: true }); check('opened without that mark (a mail scanner), it asks first', r.status === 200 && r.body.confirm && !r.cookie, r)
r = await post('/api/auth/magic', { token: mtok, auto: true }, { cookie: `sc_browser=${'x'.repeat(43)}` }); check('in another browser too', r.status === 200 && r.body.confirm && !r.cookie, r)
r = await post('/api/auth/magic', { token: mtok }); check('and pressing Sign in there signs in', r.status === 200 && r.body.email === locked && /sc_session=/.test(r.cookie ?? ''), r)
r = await me({ cookie: r.cookie.split(';')[0] }); check('as that person', r.status === 200 && r.body.email === locked, r)
r = await post('/api/auth/magic', { token: mtok }); check('the email link works only once', r.status === 400, r)
r = await post('/api/auth/verify', { email: locked, code: mcode }); check('and its code is used up with it', r.status === 400, r)
r = await post('/api/auth/magic', { token: 'made-up-token-123456789' }); check('a made-up email link is refused', r.status === 400, r)

r = await post('/api/auth/start', { email: third }, { cookie: browser }); check('the browser keeps its mark', r.cookie?.split(';')[0] === browser, r)
const ttok = r.body.devLink.split('#login=')[1]
r = await post('/api/auth/magic', { token: ttok, auto: true }, { cookie: browser }); check('in the browser that asked, the link signs in by itself', r.status === 200 && r.body.email === third && /sc_session=/.test(r.cookie ?? ''), r)
r = await post('/api/auth/magic', { token: ttok, auto: true }, { cookie: browser }); check('and only once', r.status === 200 && r.body.confirm && !r.cookie, r)

console.log(ok ? '\nALL PASS' : '\nSOME FAILED'); process.exit(ok ? 0 : 1)
