// Organisations (customers). Everyone signs in at the same address; what they see is decided here:
// their own organisation's events, never another's.
//
//   GET    /api/orgs/:id                  the organisation, its admins and events (its admins, superadmins)
//   POST   /api/orgs                      create one { name, admins: [emails] } (superadmins)
//   PATCH  /api/orgs/:id                  rename { name } (its admins, superadmins)
//   POST   /api/orgs/:id/admins           add an admin { email } (its admins, superadmins)
//   DELETE /api/orgs/:id/admins/:email    remove one (its admins, superadmins; not the last one)

import type { Env } from './env'

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const normEmail = (s: string) => s.trim().toLowerCase()
export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

/** People who run showctrl itself: they create organisations and can open any of them. */
export function isSuperadmin(env: Env, me: string): boolean {
  return (env.SUPERADMINS ?? '').split(',').map(normEmail).filter(Boolean).includes(me)
}

export async function isOrgAdmin(env: Env, me: string, orgId: string | null): Promise<boolean> {
  if (!orgId) return false
  if (isSuperadmin(env, me)) return true
  return !!(await env.DB.prepare('SELECT 1 FROM org_admins WHERE org_id = ? AND email = ?').bind(orgId, me).first())
}

/**
 * Whether someone may connect to an event at all: its members, its organisation's admins,
 * and other people in the same organisation (who can then ask to join). Nobody from outside.
 */
export async function mayConnect(env: Env, me: string, ev: { id: string; owner: string; org_id: string | null }): Promise<boolean> {
  if (ev.owner === me || isSuperadmin(env, me)) return true
  return !!(await env.DB.prepare(
    `SELECT 1 FROM memberships WHERE email = ?1 AND event_id = ?2
     UNION SELECT 1 FROM org_admins WHERE email = ?1 AND org_id = ?3
     UNION SELECT 1 FROM memberships m JOIN events e ON e.id = m.event_id WHERE m.email = ?1 AND e.org_id = ?3
     LIMIT 1`,
  ).bind(me, ev.id, ev.org_id).first())
}

/** Makes (or stops making) someone Festival admin in every event of an organisation. */
async function syncAdmin(env: Env, orgId: string, email: string, on: boolean) {
  const { results } = await env.DB.prepare('SELECT id FROM events WHERE org_id = ?').bind(orgId).all<{ id: string }>()
  await Promise.all(results.map(e => env.EVENT.getByName(e.id).setOrgAdmin(email, on)))
}

export async function orgAdmins(env: Env, orgId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT email FROM org_admins WHERE org_id = ? ORDER BY email').bind(orgId).all<{ email: string }>()
  return results.map(r => r.email)
}

/** Handles /api/orgs…, or returns null for other paths. */
export async function orgRoutes(request: Request, env: Env, me: string, url: URL): Promise<Response | null> {
  if (url.pathname === '/api/orgs' && request.method === 'POST') {
    if (!isSuperadmin(env, me)) return json({ error: 'Only whoever runs showctrl can add organisations.' }, 403)
    const body = await request.json<{ name?: string; admins?: unknown }>().catch(() => ({} as { name?: string; admins?: unknown }))
    const name = (body.name ?? '').trim().slice(0, 120)
    if (!name) return json({ error: 'Give the organisation a name.' }, 400)
    const admins = Array.isArray(body.admins) ? body.admins : []
    if (admins.some(a => !isEmail(a))) return json({ error: 'One of the admin emails doesn’t look right.' }, 400)
    const id = crypto.randomUUID()
    await env.DB.batch([
      env.DB.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)').bind(id, name, Date.now()),
      ...[...new Set(admins.map(a => normEmail(a as string)))].map(a => env.DB.prepare('INSERT OR IGNORE INTO org_admins (org_id, email) VALUES (?, ?)').bind(id, a)),
    ])
    return json({ id }, 201)
  }

  const m = url.pathname.match(/^\/api\/orgs\/([\w-]+)(\/admins(?:\/([^/]+))?)?$/)
  if (!m) return null
  const [, orgId, adminsPath, emailPart] = m
  const org = await env.DB.prepare('SELECT id, name FROM orgs WHERE id = ?').bind(orgId).first<{ id: string; name: string }>()
  if (!org || !(await isOrgAdmin(env, me, orgId))) return json({ error: 'No such organisation.' }, 404)

  if (!adminsPath && request.method === 'GET') {
    const { results: events } = await env.DB.prepare('SELECT id, name, owner FROM events WHERE org_id = ? ORDER BY created_at DESC').bind(orgId).all()
    return json({ ...org, admins: await orgAdmins(env, orgId), events })
  }
  if (!adminsPath && request.method === 'PATCH') {
    const name = ((await request.json<{ name?: string }>().catch(() => ({} as { name?: string }))).name ?? '').trim().slice(0, 120)
    if (!name) return json({ error: 'Give the organisation a name.' }, 400)
    await env.DB.prepare('UPDATE orgs SET name = ? WHERE id = ?').bind(name, orgId).run()
    return json({ ok: true })
  }
  if (adminsPath && !emailPart && request.method === 'POST') {
    const { email } = await request.json<{ email?: unknown }>().catch(() => ({} as { email?: unknown }))
    if (!isEmail(email)) return json({ error: 'That doesn’t look like an email address.' }, 400)
    const e = normEmail(email)
    await env.DB.prepare('INSERT OR IGNORE INTO org_admins (org_id, email) VALUES (?, ?)').bind(orgId, e).run()
    await syncAdmin(env, orgId, e, true)
    return json({ admins: await orgAdmins(env, orgId) })
  }
  if (adminsPath && emailPart && request.method === 'DELETE') {
    const e = normEmail(decodeURIComponent(emailPart))
    const admins = await orgAdmins(env, orgId)
    if (admins.includes(e) && admins.length === 1) return json({ error: 'An organisation needs at least one admin. Add another first.' }, 400)
    await env.DB.prepare('DELETE FROM org_admins WHERE org_id = ? AND email = ?').bind(orgId, e).run()
    await syncAdmin(env, orgId, e, false)
    return json({ admins: await orgAdmins(env, orgId) })
  }
  return json({ error: 'Not found' }, 404)
}
