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
//   DELETE /api/orgs/:id                   delete it, once it has no events (superadmins)
//   DELETE /api/events/:id                 delete an event and everything in it (superadmins)
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
  const event = request.method === 'DELETE' ? url.pathname.match(/^\/api\/events\/([\w-]+)$/) : null
  if (!orgs && !admins && !event) return null
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)

  if (event) {
    const id = event[1]
    if (!(await env.DB.prepare('SELECT 1 FROM events WHERE id = ?').bind(id).first())) return json({ error: 'No such event.' }, 404)
    // Out of the index first, so nobody can open it while it's being emptied.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id),
      env.DB.prepare('DELETE FROM memberships WHERE event_id = ?').bind(id),
      env.DB.prepare('UPDATE users SET last_event = NULL WHERE last_event = ?').bind(id),
    ])
    await env.EVENT.getByName(id).destroy()
    console.log(JSON.stringify({ level: 'info', what: 'event deleted', id, by: me }))
    return json({ ok: true })
  }

  if (orgs) {
    const [, orgId] = orgs
    if (orgId && request.method === 'DELETE') {
      const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE org_id = ?').bind(orgId).first<{ n: number }>())?.n ?? 0
      if (n) return json({ error: `Delete its ${n === 1 ? 'event' : `${n} events`} first.` }, 400)
      await env.DB.batch([
        env.DB.prepare('DELETE FROM orgs WHERE id = ?').bind(orgId),
        env.DB.prepare('DELETE FROM org_admins WHERE org_id = ?').bind(orgId),
      ])
      return json({ ok: true })
    }
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
