// Who is calling: verified from the Cloudflare Access token on every request.
// Access sits in front of the whole app, so an unauthenticated request never reaches here
// in production; the token check makes sure nobody can bypass Access by calling the Worker directly.

import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from './env'

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export type AuthResult = { ok: true; email: string } | { ok: false; status: number; message: string }

export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  // Local development only: `wrangler dev` with DEV_USER_EMAIL in .dev.vars and no Access configured.
  // `?as=email` lets you open a second window as someone else.
  if (env.DEV_USER_EMAIL && !env.ACCESS_AUD) {
    const as = new URL(request.url).searchParams.get('as')
    return { ok: true, email: (as || env.DEV_USER_EMAIL).trim().toLowerCase() }
  }
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) {
    return { ok: false, status: 500, message: 'Sign-in is not configured. Set ACCESS_TEAM_DOMAIN and ACCESS_AUD.' }
  }

  const token = request.headers.get('cf-access-jwt-assertion') ?? cookie(request, 'CF_Authorization')
  if (!token) return { ok: false, status: 401, message: 'Not signed in.' }

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

function cookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}
