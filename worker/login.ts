// showctrl's own sign-in: email → 6-digit code → session cookie. No passwords.
//
//   POST /api/auth/start   { email }        sends a code, if showctrl knows the address
//   POST /api/auth/verify  { email, code }  signs in: sets the session cookie
//   POST /api/auth/logout                   ends this session
//
// Codes last 10 minutes and allow 5 tries. Sending is rate-limited per address and per IP.
// Only addresses showctrl knows (superadmins, organisation admins, event members) get a code,
// so the site can't be used to send mail to strangers. The answer is the same either way,
// so it doesn't reveal who has access. Codes and session tokens are stored only as SHA-256 hashes.

import type { Env } from './env'
import { isEmail, isSuperadmin, json, normEmail } from './orgs'

const MIN = 60_000
const HOUR = 60 * MIN
const CODE_TTL = 10 * MIN
const SESSION_TTL = 30 * 24 * HOUR
const MAX_TRIES = 5
const RESEND_AFTER = MIN
const PER_EMAIL_PER_HOUR = 5
const PER_IP_PER_HOUR = 20

export const SESSION_COOKIE = 'sc_session'

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
    `SELECT 1 FROM org_admins WHERE email = ?1 UNION SELECT 1 FROM memberships WHERE email = ?1 UNION SELECT 1 FROM events WHERE owner = ?1 LIMIT 1`,
  ).bind(email).first())
}

async function body(request: Request): Promise<Record<string, unknown>> {
  return await request.json<Record<string, unknown>>().catch(() => ({}))
}

/** Handles /api/auth/…, or returns null for other paths. These need no sign-in. */
export async function loginRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method !== 'POST') return null
  if (url.pathname === '/api/auth/start') return start(request, env)
  if (url.pathname === '/api/auth/verify') return verify(request, env, url)
  if (url.pathname === '/api/auth/logout') return logout(request, env, url)
  return null
}

async function start(request: Request, env: Env): Promise<Response> {
  const b = await body(request)
  if (!isEmail(b.email)) return json({ error: 'That doesn’t look like an email address.' }, 400)
  const email = normEmail(b.email)
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
  await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)')
      .bind(email, await sha256(`${email}:${code}`), now + CODE_TTL, now),
    env.DB.prepare('INSERT INTO login_sends (key, at) VALUES (?, ?)').bind(`e:${email}`, now),
  ])
  if (isDev(env)) return json({ ok: true, devCode: code })
  if (!env.EMAIL) return json({ error: 'Sign-in email isn’t set up on this site.' }, 500)
  try {
    await env.EMAIL.send({
      to: email,
      from: { email: env.LOGIN_FROM ?? 'login@showctrl.no', name: 'showctrl' },
      subject: `${code} is your showctrl code`,
      text: `Your showctrl sign-in code is ${code}\n\nIt works for 10 minutes. If you didn’t ask for it, you can ignore this email.\n`,
      html: codeEmail(code, new URL(request.url).origin),
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
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie(token, SESSION_TTL / 1000, url.protocol === 'https:'), 'cache-control': 'no-store' } })
}

async function logout(request: Request, env: Env, url: URL): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  return Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0, url.protocol === 'https:'), 'cache-control': 'no-store' } })
}

function codeEmail(code: string, origin: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:10px;padding:32px">
<tr><td><img src="${origin}/brand/logo-dark.png" alt="showctrl" height="28" style="display:block;height:28px;width:auto"></td></tr>
<tr><td style="padding-top:24px;font-size:16px">Your sign-in code:</td></tr>
<tr><td style="padding:12px 0 20px;font-size:36px;font-weight:700;letter-spacing:8px">${code}</td></tr>
<tr><td style="font-size:14px;color:#555">It works for 10 minutes. If you didn’t ask for it, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`
}
