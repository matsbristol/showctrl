// Who is calling, checked on every API request:
// 1. showctrl's own session cookie (login.ts), which is how people sign in;
// 2. a Cloudflare Access token, if Access is configured (kept for scripts and the move away from Access);
// 3. `wrangler dev` only: DEV_USER_EMAIL, or `?as=email`.

import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from './env'
import { isDev, sessionEmail } from './login'

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export type AuthResult = { ok: true; email: string } | { ok: false; status: number; message: string }

export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  const session = await sessionEmail(request, env)
  if (session) return { ok: true, email: session }

  // Local development only. `?as=email` opens a second window as someone else; the
  // x-showctrl-anon header lets tests see what a signed-out visitor gets.
  if (isDev(env) && !request.headers.get('x-showctrl-anon')) {
    const as = new URL(request.url).searchParams.get('as')
    return { ok: true, email: (as || env.DEV_USER_EMAIL!).trim().toLowerCase() }
  }

  const token = env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN ? request.headers.get('cf-access-jwt-assertion') : null
  if (!token || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) return { ok: false, status: 401, message: 'Not signed in.' }

  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '')
  let jwks = jwksCache.get(issuer)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
    jwksCache.set(issuer, jwks)
  }
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD })
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (!email) return { ok: false, status: 403, message: 'Your sign-in has no email address.' }
    return { ok: true, email }
  } catch {
    return { ok: false, status: 401, message: 'Your sign-in has expired. Reload the page.' }
  }
}
