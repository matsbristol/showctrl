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
//   GET    /api/events/:id/backup          download one event as JSON (superadmins)
//   GET    /api/backup                     download everything as JSON (superadmins)
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
  const backup = request.method === 'GET' ? url.pathname.match(/^\/api\/(?:events\/([\w-]+)\/)?backup$/) : null
  if (!orgs && !admins && !event && !backup) return null
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)

  if (backup) return downloadBackup(env, me, backup[1] ?? null)

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

type EventRow = { id: string; name: string; owner: string; org_id: string | null; created_at: number }

async function eventBackup(env: Env, ev: EventRow, orgName: string | null) {
  return { id: ev.id, name: ev.name, owner: ev.owner, customer: ev.org_id ? { id: ev.org_id, name: orgName } : null, createdAt: ev.created_at, ...((await env.EVENT.getByName(ev.id).exportAll()) as Record<string, unknown>) }
}

/**
 * A JSON download: one event, or (eventId null) the whole portfolio: customers, the event index,
 * memberships, and every event in full. Sign-in codes and sessions are never included.
 */
async function downloadBackup(env: Env, me: string, eventId: string | null): Promise<Response> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const base = { format: 'showctrl-backup', version: 1, exportedAt: new Date().toISOString(), exportedBy: me }
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event'
  let body: unknown
  let filename: string
  if (eventId) {
    const ev = await env.DB.prepare('SELECT e.id, e.name, e.owner, e.org_id, e.created_at, o.name AS org_name FROM events e LEFT JOIN orgs o ON o.id = e.org_id WHERE e.id = ?')
      .bind(eventId).first<EventRow & { org_name: string | null }>()
    if (!ev) return json({ error: 'No such event.' }, 404)
    body = { ...base, scope: 'event', event: await eventBackup(env, ev, ev.org_name) }
    filename = `showctrl-${slug(ev.name)}-${stamp}.json`
  } else {
    const [orgs, events, memberships, users] = await env.DB.batch<Record<string, unknown>>([
      env.DB.prepare('SELECT id, name, created_at FROM orgs ORDER BY name'),
      env.DB.prepare('SELECT id, name, owner, org_id, created_at FROM events ORDER BY created_at'),
      env.DB.prepare('SELECT event_id, email FROM memberships ORDER BY event_id, email'),
      env.DB.prepare('SELECT email, last_event, seen_at FROM users ORDER BY email'),
    ])
    const orgName = new Map(orgs.results.map(o => [o.id as string, o.name as string]))
    const all = []
    for (const ev of events.results as unknown as EventRow[]) all.push(await eventBackup(env, ev, ev.org_id ? orgName.get(ev.org_id) ?? null : null))
    body = { ...base, scope: 'all', superadmins: superadmins(env), customers: orgs.results, index: { events: events.results, memberships: memberships.results, users: users.results }, events: all }
    filename = `showctrl-backup-${stamp}.json`
  }
  console.log(JSON.stringify({ level: 'info', what: 'backup downloaded', scope: eventId ?? 'all', by: me }))
  return new Response(JSON.stringify(body, null, 1), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'no-store' },
  })
}
