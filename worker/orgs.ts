// Who sees what across showctrl.
//
// - Superadmins (SUPERADMINS) run the whole portfolio: they create every event, appoint its
//   admins, and are Festival admin inside every event.
// - Event admins are Festival admin in their own events only: they add that event's people.
// - Everyone else sees only the events they've been added to.
// Organisations are customer folders that group events for superadmins; they grant nothing.
//
//   POST   /api/orgs                       add a customer { name } (superadmins)
//   PATCH  /api/orgs/:id                   rename it { name } (superadmins)
//   GET    /api/events/:id/admins          an event's admins (superadmins)
//   POST   /api/events/:id/admins          appoint one { email } (superadmins)
//   DELETE /api/events/:id/admins/:email   remove one (superadmins; not the event's creator)

import type { Env } from './env'

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const normEmail = (s: string) => s.trim().toLowerCase()
export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

export function superadmins(env: Env): string[] {
  return (env.SUPERADMINS ?? '').split(',').map(normEmail).filter(Boolean)
}

export function isSuperadmin(env: Env, me: string): boolean {
  return superadmins(env).includes(me)
}

/** Only an event's own people (and superadmins) may connect to it. */
export async function mayConnect(env: Env, me: string, ev: { id: string; owner: string }): Promise<boolean> {
  if (ev.owner === me || isSuperadmin(env, me)) return true
  return !!(await env.DB.prepare('SELECT 1 FROM memberships WHERE email = ? AND event_id = ?').bind(me, ev.id).first())
}

const body = async (request: Request) => await request.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))

/** Handles /api/orgs… and /api/events/:id/admins…, or returns null for other paths. */
export async function portfolioRoutes(request: Request, env: Env, me: string, url: URL): Promise<Response | null> {
  const orgs = url.pathname.match(/^\/api\/orgs(?:\/([\w-]+))?$/)
  const admins = url.pathname.match(/^\/api\/events\/([\w-]+)\/admins(?:\/([^/]+))?$/)
  if (!orgs && !admins) return null
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)

  if (orgs) {
    const [, orgId] = orgs
    const name = String((await body(request)).name ?? '').trim().slice(0, 120)
    if (!name) return json({ error: 'Give the customer a name.' }, 400)
    if (!orgId && request.method === 'POST') {
      const id = crypto.randomUUID()
      await env.DB.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)').bind(id, name, Date.now()).run()
      return json({ id }, 201)
    }
    if (orgId && request.method === 'PATCH') {
      await env.DB.prepare('UPDATE orgs SET name = ? WHERE id = ?').bind(name, orgId).run()
      return json({ ok: true })
    }
    return json({ error: 'Not found' }, 404)
  }

  const [, eventId, emailPart] = admins!
  const ev = await env.DB.prepare('SELECT id, owner FROM events WHERE id = ?').bind(eventId).first<{ id: string; owner: string }>()
  if (!ev) return json({ error: 'No such event.' }, 404)
  const stub = env.EVENT.getByName(eventId)
  if (!emailPart && request.method === 'GET') return json({ owner: ev.owner, admins: await stub.admins() })
  if (!emailPart && request.method === 'POST') {
    const { email } = await body(request)
    if (!isEmail(email)) return json({ error: 'That doesn’t look like an email address.' }, 400)
    await stub.setEventAdmin(normEmail(email), true)
    return json({ owner: ev.owner, admins: await stub.admins() })
  }
  if (emailPart && request.method === 'DELETE') {
    const e = normEmail(decodeURIComponent(emailPart))
    if (e === ev.owner) return json({ error: 'The event’s creator is always an admin.' }, 400)
    await stub.setEventAdmin(e, false)
    return json({ owner: ev.owner, admins: await stub.admins() })
  }
  return json({ error: 'Not found' }, 404)
}
