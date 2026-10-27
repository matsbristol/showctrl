// showctrl's own sign-in: email → 6-digit code → session cookie. No passwords.
//
//   POST /api/auth/start   { email }        sends a code, if showctrl knows the address
//   POST /api/auth/verify  { email, code }  signs in: sets the session cookie
//   POST /api/auth/logout                   ends this session
//   POST /api/auth/link    { token }        signs in with a sign-in link from a superadmin
//   POST /api/auth/magic   { token, auto? } signs in with the link in the sign-in email (once, 10 minutes)
//
// The email's link signs in as soon as it opens, but only in the browser that asked for the code
// (`auto`, checked against the sc_browser cookie set by /start). Anywhere else, such as a phone or
// a mail scanner that opens links to check them, the page asks the person to press Sign in, so a
// scanner can't use the link up.
//
// When the email doesn't arrive (a strict mail filter, a brand-new domain), a superadmin can make
// a sign-in link (createSigninLink) and send it another way, e.g. by text message. It works every
// time for 30 days; making a new one, or cancelling it, stops the old one. The token sits after #
// in the link, so link previews in chat apps never send it to the server; it's only used when the
// person presses "Sign in". Stored only as a hash.
//
// Codes last 10 minutes and allow 5 tries. Sending is rate-limited per address and per IP.
// Only addresses showctrl knows (superadmins and event members) get a code,
// so the site can't be used to send mail to strangers. The answer is the same either way,
// so it doesn't reveal who has access. Codes and session tokens are stored only as SHA-256 hashes.

import type { Env } from './env'
import { recordSignin } from './analytics'
import { isEmail, isSuperadmin, json, normEmail } from './orgs'

const MIN = 60_000
const HOUR = 60 * MIN
const CODE_TTL = 10 * MIN
const SESSION_TTL = 30 * 24 * HOUR
const MAX_TRIES = 5
const RESEND_AFTER = MIN
const LINK_TTL = 30 * 24 * HOUR
const PER_EMAIL_PER_HOUR = 5
const PER_IP_PER_HOUR = 20

export const SESSION_COOKIE = 'sc_session'
/** Marks the browser that asked for a code. Only sent to /api/auth. */
const BROWSER_COOKIE = 'sc_browser'
const BROWSER_TTL = 24 * HOUR

/** `wrangler dev` only (DEV_USER_EMAIL in .dev.vars, no Access): codes are returned instead of emailed. */
export const isDev = (env: Env) => !!env.DEV_USER_EMAIL && !env.ACCESS_AUD

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function randomCode(): string {
  // Rejection sampling keeps every code equally likely.
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < 4_294_000_000) return String(buf[0] % 1_000_000).padStart(6, '0')
  }
}

function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

function browserCookie(value: string, maxAge: number, secure: boolean): string {
  return `${BROWSER_COOKIE}=${value}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

/** The signed-in email for this request's session cookie, if the session is still valid. */
export async function sessionEmail(request: Request, env: Env): Promise<string | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const row = await env.DB.prepare('SELECT email FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), Date.now()).first<{ email: string }>()
  return row?.email ?? null
}

/** Whether showctrl has any reason to let this address in. */
async function isKnown(env: Env, email: string): Promise<boolean> {
  if (isSuperadmin(env, email)) return true
  return !!(await env.DB.prepare(
    `SELECT 1 FROM memberships WHERE email = ?1 UNION SELECT 1 FROM events WHERE owner = ?1 LIMIT 1`,
  ).bind(email).first())
}

async function body(request: Request): Promise<Record<string, unknown>> {
  return await request.json<Record<string, unknown>>().catch(() => ({}))
}

/** Handles /api/auth/…, or returns null for other paths. These need no sign-in. */
export async function loginRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method !== 'POST') return null
  if (url.pathname === '/api/auth/start') return start(request, env, url)
  if (url.pathname === '/api/auth/verify') return verify(request, env, url)
  if (url.pathname === '/api/auth/logout') return logout(request, env, url)
  if (url.pathname === '/api/auth/link') return linkSignIn(request, env, url)
  if (url.pathname === '/api/auth/magic') return magicSignIn(request, env, url)
  return null
}

async function start(request: Request, env: Env, url: URL): Promise<Response> {
  // Every answer marks this browser, for known and unknown addresses alike.
  const old = readCookie(request, BROWSER_COOKIE)
  const browser = old && /^[\w-]{40,64}$/.test(old) ? old : randomToken()
  const res = await sendCode(request, env, browser)
  res.headers.append('set-cookie', browserCookie(browser, BROWSER_TTL / 1000, url.protocol === 'https:'))
  return res
}

async function sendCode(request: Request, env: Env, browser: string): Promise<Response> {
  const b = await body(request)
  if (!isEmail(b.email)) return json({ error: 'That doesn’t look like an email address.' }, 400)
  const email = normEmail(b.email)
  const nb = b.lang === 'nb'
  const ip = request.headers.get('cf-connecting-ip') ?? 'local'
  const now = Date.now()

  // Housekeeping, then the limits.
  const [, , , ipSends, emailSends, existing] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare('DELETE FROM login_sends WHERE at < ?').bind(now - HOUR),
    env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('SELECT COUNT(*) AS n FROM login_sends WHERE key = ?').bind(`ip:${ip}`),
    env.DB.prepare('SELECT COUNT(*) AS n FROM login_sends WHERE key = ?').bind(`e:${email}`),
    env.DB.prepare('SELECT sent_at FROM login_codes WHERE email = ?').bind(email),
  ])
  if ((ipSends.results[0]?.n as number) >= PER_IP_PER_HOUR) return json({ error: 'Too many sign-in attempts from here. Try again in an hour.' }, 429)
  await env.DB.prepare('INSERT INTO login_sends (key, at) VALUES (?, ?)').bind(`ip:${ip}`, now).run()

  const ok = json({ ok: true })
  const sentAt = existing.results[0]?.sent_at as number | undefined
  if (sentAt && now - sentAt < RESEND_AFTER) return ok // the last code is still on its way
  if ((emailSends.results[0]?.n as number) >= PER_EMAIL_PER_HOUR) return ok
  if (!(await isKnown(env, email))) return ok

  const code = randomCode()
  // The email also carries a link. The token sits after #, so mail scanners that only fetch links
  // never send it, and it signs in without a press only in this browser (see magicSignIn).
  const linkToken = randomToken()
  const link = `${env.PUBLIC_URL ?? new URL(request.url).origin}/#login=${linkToken}`
  await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO login_codes (email, code_hash, expires_at, attempts, sent_at, link_hash, browser_hash) VALUES (?, ?, ?, 0, ?, ?, ?)')
      .bind(email, await sha256(`${email}:${code}`), now + CODE_TTL, now, await sha256(linkToken), await sha256(browser)),
    env.DB.prepare('INSERT INTO login_sends (key, at) VALUES (?, ?)').bind(`e:${email}`, now),
  ])
  if (isDev(env)) return json({ ok: true, devCode: code, devLink: link })
  if (!env.EMAIL) return json({ error: 'Sign-in email isn’t set up on this site.' }, 500)
  try {
    await env.EMAIL.send({
      to: email,
      from: { email: env.LOGIN_FROM ?? 'login@showctrl.no', name: 'showctrl' },
      subject: nb ? `${code} er koden din til showctrl` : `${code} is your showctrl code`,
      text: nb
        ? `Logg inn på showctrl:\n${link}\n\nEller skriv inn koden: ${code}\n\nLenken og koden virker i 10 minutter, og bare én gang. Har du ikke bedt om dem, kan du se bort fra denne e-posten.\n`
        : `Sign in to showctrl:\n${link}\n\nOr enter the code: ${code}\n\nThe link and the code work for 10 minutes, once. If you didn’t ask for them, you can ignore this email.\n`,
      html: codeEmail(code, link, new URL(request.url).origin, nb),
    })
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', what: 'login email', error: String(e) }))
    return json({ error: 'Couldn’t send the email. Try again in a minute.' }, 502)
  }
  return ok
}

async function verify(request: Request, env: Env, url: URL): Promise<Response> {
  const b = await body(request)
  if (!isEmail(b.email) || typeof b.code !== 'string') return json({ error: 'Enter your email and the code.' }, 400)
  const email = normEmail(b.email)
  const code = b.code.replace(/\D/g, '')
  const now = Date.now()
  const row = await env.DB.prepare('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?').bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>()
  if (!row || row.expires_at < now) return json({ error: 'That code has expired. Ask for a new one.' }, 400)
  if (row.attempts >= MAX_TRIES) {
    await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run()
    return json({ error: 'Too many wrong tries. Ask for a new code.' }, 400)
  }
  if ((await sha256(`${email}:${code}`)) !== row.code_hash) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run()
    const left = MAX_TRIES - row.attempts - 1
    return json({ error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Ask for a new code.' }, 400)
  }
  const token = randomToken()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email),
    env.DB.prepare('INSERT INTO sessions (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), email, now, now + SESSION_TTL),
  ])
  await recordSignin(request, env, email, 'code')
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(token, SESSION_TTL / 1000, url.protocol === 'https:'), 'cache-control': 'no-store' } })
}

/**
 * Superadmins: POST makes a sign-in link for someone showctrl knows (replacing any earlier one),
 * DELETE cancels it. Not for other superadmins.
 */
export async function signinLinkRoute(request: Request, env: Env, me: string): Promise<Response> {
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)
  const b = await body(request)
  if (!isEmail(b.email)) return json({ error: 'That doesn’t look like an email address.' }, 400)
  const email = normEmail(b.email)
  const now = Date.now()
  const clear = env.DB.prepare('DELETE FROM signin_links WHERE email = ? OR expires_at < ?').bind(email, now)
  if (request.method === 'DELETE') {
    await clear.run()
    console.log(JSON.stringify({ level: 'info', what: 'signin link cancelled', for: email, by: me }))
    return json({ ok: true })
  }
  if (isSuperadmin(env, email)) return json({ error: 'Superadmins sign in with their own email.' }, 400)
  if (!(await isKnown(env, email))) return json({ error: 'This address has no access to any event yet.' }, 400)
  const token = randomToken()
  await env.DB.batch([
    clear,
    env.DB.prepare('INSERT INTO signin_links (token_hash, email, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(token), email, me, now, now + LINK_TTL),
  ])
  console.log(JSON.stringify({ level: 'info', what: 'signin link', for: email, by: me }))
  const origin = env.PUBLIC_URL ?? new URL(request.url).origin
  return json({ url: `${origin}/#signin=${token}`, expiresAt: now + LINK_TTL })
}

async function linkSignIn(request: Request, env: Env, url: URL): Promise<Response> {
  const b = await body(request)
  if (typeof b.token !== 'string' || !b.token) return json({ error: 'That sign-in link isn’t complete.' }, 400)
  const now = Date.now()
  const row = await env.DB.prepare('UPDATE signin_links SET uses = uses + 1, last_used_at = ?1 WHERE token_hash = ?2 AND expires_at > ?1 RETURNING email')
    .bind(now, await sha256(b.token)).first<{ email: string }>()
  if (!row) return json({ error: 'This sign-in link has expired or was replaced. Ask for a new one.' }, 400)
  const token = randomToken()
  await env.DB.prepare('INSERT INTO sessions (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), row.email, now, now + SESSION_TTL).run()
  await recordSignin(request, env, row.email, 'link')
  return Response.json({ ok: true, email: row.email }, { headers: { 'set-cookie': sessionCookie(token, SESSION_TTL / 1000, url.protocol === 'https:'), 'cache-control': 'no-store' } })
}

async function magicSignIn(request: Request, env: Env, url: URL): Promise<Response> {
  const b = await body(request)
  if (typeof b.token !== 'string' || !b.token) return json({ error: 'That sign-in link isn’t complete.' }, 400)
  const now = Date.now()
  // `auto` (the page just opened): only in the browser that asked for the code. Otherwise the
  // link stays unused and the page asks the person to press Sign in.
  const auto = b.auto === true
  const browser = readCookie(request, BROWSER_COOKIE)
  if (auto && !browser) return json({ confirm: true })
  // Used up in the same statement that checks it, together with the code it came with.
  const row = await env.DB.prepare('DELETE FROM login_codes WHERE link_hash = ?1 AND expires_at > ?2 AND (?3 = 0 OR browser_hash = ?4) RETURNING email')
    .bind(await sha256(b.token), now, auto ? 1 : 0, browser ? await sha256(browser) : '').first<{ email: string }>()
  if (!row && auto) return json({ confirm: true })
  if (!row) return json({ error: 'This sign-in link has been used or has expired. Ask for a new code.' }, 400)
  const token = randomToken()
  await env.DB.prepare('INSERT INTO sessions (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), row.email, now, now + SESSION_TTL).run()
  await recordSignin(request, env, row.email, 'email-link')
  return Response.json({ ok: true, email: row.email }, { headers: { 'set-cookie': sessionCookie(token, SESSION_TTL / 1000, url.protocol === 'https:'), 'cache-control': 'no-store' } })
}

async function logout(request: Request, env: Env, url: URL): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0, url.protocol === 'https:'), 'cache-control': 'no-store' } })
}

function codeEmail(code: string, link: string, origin: string, nb = false): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:10px;padding:32px">
<tr><td><img src="${origin}/brand/logo-dark.png" alt="showctrl" height="28" style="display:block;height:28px;width:auto"></td></tr>
<tr><td style="padding-top:28px"><a href="${link}" style="display:inline-block;background:#2348C6;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 26px;border-radius:8px">${nb ? 'Logg inn på showctrl' : 'Sign in to showctrl'}</a></td></tr>
<tr><td style="padding-top:28px;font-size:15px;color:#333">${nb ? 'Eller skriv inn koden:' : 'Or enter the code:'}</td></tr>
<tr><td style="padding:8px 0 20px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</td></tr>
<tr><td style="font-size:14px;color:#555">${nb ? 'Lenken og koden virker i 10 minutter, og bare én gang. Har du ikke bedt om dem, kan du se bort fra denne e-posten.' : 'The link and the code work for 10 minutes, once. If you didn’t ask for them, you can ignore this email.'}</td></tr>
</table></td></tr></table></body></html>`
}
