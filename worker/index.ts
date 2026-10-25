// The showctrl Worker: serves the app, the API and the live connection for each event.
//
//   GET  /time                       server time, for clock sync (no sign-in needed)
//   POST /api/auth/start|verify|logout  sign-in with an emailed code (see login.ts)
//   GET  /api/me                     who you are, your organisations and your events
//   POST /api/events                 create an event { name, sample?, org, admins } (superadmins)
//   DELETE /api/events/:id           delete an event (superadmins)
//   GET  /api/backup, /api/events/:id/backup   JSON backups (superadmins)
//        /api/orgs…, /api/events/:id/admins…   customers and event admins (superadmins; see orgs.ts)
//   POST /api/me/last-event          remember which event you opened { id }
//   POST /api/me/prefs               save your settings { font }
//   POST /api/events/:id/files       upload a document file (raw body; ?name=&stage=&artist=)
//   GET  /api/events/:id/files/:key  download one, if you may see its document
//   GET  /api/events/:id/ws          WebSocket to the event's Durable Object
//   everything else                  the built app (single-page fallback)

import { blankEvent, buildSample } from '../src/data/sample'
import type { CollectionData } from '../src/server/core'
import { authenticate } from './auth'
import type { Env } from './env'
import { EMAIL_HEADER } from './event'
import { isFontId } from '../src/shared/fonts'
import { isDev, loginRoutes } from './login'
import { isEmail, isSuperadmin, json, mayConnect, normEmail, portfolioRoutes } from './orgs'

export { EventObject } from './event'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // `colo` is the Cloudflare data centre that answered; its clock is Cloudflare's NTP-synced time.
    if (url.pathname === '/time') return json({ now: Date.now(), colo: (request.cf?.colo as string | undefined) ?? null })
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    // Requests that change something, and live connections, must come from showctrl's own pages.
    // (The session cookie is SameSite=Lax as well; this also covers WebSockets.)
    const origin = request.headers.get('origin')
    if (origin && !isDev(env) && new URL(origin).host !== url.host && (request.method !== 'GET' || request.headers.get('upgrade'))) {
      return json({ error: 'Cross-site request refused.' }, 403)
    }
    const login = await loginRoutes(request, env, url).catch(e => {
      console.error(JSON.stringify({ level: 'error', path: url.pathname, error: String(e) }))
      return json({ error: 'Something went wrong. Try again.' }, 500)
    })
    if (login) return login

    const auth = await authenticate(request, env)
    if (!auth.ok) return json({ error: auth.message }, auth.status)
    const me = auth.email

    try {
      if (url.pathname === '/api/me' && request.method === 'GET') return await getMe(env, me)
      if (url.pathname === '/api/events' && request.method === 'POST') return await createEvent(request, env, me)
      if (url.pathname === '/api/me/prefs' && request.method === 'POST') {
        const { font } = await request.json<{ font?: unknown }>().catch(() => ({} as { font?: unknown }))
        if (!isFontId(font)) return json({ error: 'Unknown font.' }, 400)
        await env.DB.prepare('INSERT INTO users (email, font) VALUES (?1, ?2) ON CONFLICT(email) DO UPDATE SET font = ?2').bind(me, font).run()
        return json({ ok: true })
      }
      if (url.pathname === '/api/me/last-event' && request.method === 'POST') {
        const { id } = await request.json<{ id?: string }>()
        if (typeof id !== 'string') return json({ error: 'Missing id' }, 400)
        await env.DB.prepare('INSERT INTO users (email, last_event, seen_at) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO UPDATE SET last_event = ?2, seen_at = ?3')
          .bind(me, id, Date.now()).run()
        return json({ ok: true })
      }
      const portfolio = await portfolioRoutes(request, env, me, url)
      if (portfolio) return portfolio
      const up = url.pathname.match(/^\/api\/events\/([\w-]+)\/files$/)
      if (up && request.method === 'POST') return await upload(request, env, me, up[1], url)
      const down = url.pathname.match(/^\/api\/events\/([\w-]+)\/files\/([\w-]+)$/)
      if (down && request.method === 'GET') return await download(env, me, down[1], `${down[1]}/${down[2]}`)
      const ws = url.pathname.match(/^\/api\/events\/([\w-]+)\/ws$/)
      if (ws) {
        if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket' }, 426)
        const ev = await env.DB.prepare('SELECT id, owner FROM events WHERE id = ?').bind(ws[1]).first<{ id: string; owner: string }>()
        if (!ev) return json({ error: 'No such event' }, 404)
        // Only the event's own people (and superadmins) get through; the event then decides what each sees.
        if (!(await mayConnect(env, me, ev))) return json({ error: 'No such event' }, 404)
        const headers = new Headers(request.headers)
        headers.set(EMAIL_HEADER, me)
        return env.EVENT.getByName(ws[1]).fetch(new Request(request.url, { headers }))
      }
      return json({ error: 'Not found' }, 404)
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', path: url.pathname, error: String(e) }))
      return json({ error: 'Something went wrong. Try again.' }, 500)
    }
  },
} satisfies ExportedHandler<Env>

async function getMe(env: Env, me: string): Promise<Response> {
  const sup = isSuperadmin(env, me) ? 1 : 0
  // Superadmins see the whole portfolio; everyone else the events they belong to.
  const mine = `?2 = 1 OR e.owner = ?1 OR e.id IN (SELECT event_id FROM memberships WHERE email = ?1)`
  const [events, orgs, user] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(`SELECT e.id, e.name, e.owner, e.org_id AS org FROM events e WHERE ${mine} ORDER BY e.created_at DESC`).bind(me, sup),
    env.DB.prepare(
      `SELECT o.id, o.name FROM orgs o WHERE ?2 = 1 OR o.id IN (SELECT e.org_id FROM events e WHERE ${mine}) ORDER BY o.name COLLATE NOCASE`,
    ).bind(me, sup),
    env.DB.prepare('SELECT last_event, font FROM users WHERE email = ?').bind(me),
  ])
  return json({
    email: me,
    superadmin: !!sup,
    orgs: orgs.results.map(o => ({ ...o, admin: !!sup })),
    events: events.results,
    lastEvent: (user.results[0]?.last_event as string | null | undefined) ?? null,
    canCreate: !!sup,
    font: (user.results[0]?.font as string | null | undefined) ?? null,
  })
}

async function createEvent(request: Request, env: Env, me: string): Promise<Response> {
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins create events.' }, 403)
  const body = await request.json<{ name?: string; sample?: boolean; org?: string; admins?: unknown }>()
  const org = typeof body.org === 'string' ? body.org : null
  if (!org || !(await env.DB.prepare('SELECT 1 FROM orgs WHERE id = ?').bind(org).first())) return json({ error: 'Choose the customer the event is for.' }, 400)
  const admins = Array.isArray(body.admins) ? body.admins : []
  if (admins.some(a => !isEmail(a))) return json({ error: 'One of the admin emails doesn’t look right.' }, 400)
  const name = (body.name ?? '').trim().slice(0, 120) || 'New festival'
  const id = crypto.randomUUID()
  const data = body.sample ? buildSample() : blankEvent()
  if (data.cfg) data.cfg = { ...data.cfg, name: body.sample ? data.cfg.name : name }
  delete data.col.members['demo-admin']
  // The creator owns the event; the admins they name run it (Festival admin, this event only).
  for (const a of [me, ...admins.map(a => normEmail(a as string))]) data.col.members[a] ??= { id: a, name: a, role: 'admin', person: null, depts: [], stages: {} }
  await env.DB.prepare('INSERT INTO events (id, name, owner, created_at, org_id) VALUES (?, ?, ?, ?, ?)').bind(id, data.cfg!.name, me, Date.now(), org).run()
  await env.EVENT.getByName(id).init(id, me, { cfg: data.cfg!, roles: data.roles!, col: data.col as unknown as CollectionData })
  return json({ id }, 201)
}

const MAX_UPLOAD = 25 * 1024 * 1024

async function upload(request: Request, env: Env, me: string, eventId: string, url: URL): Promise<Response> {
  if (!env.FILES) return json({ error: 'File uploads aren’t switched on for this site yet. Add a link instead.' }, 503)
  const ok = await env.EVENT.getByName(eventId).canUpload(me, { stage: url.searchParams.get('stage'), artist: url.searchParams.get('artist') })
  if (!ok) return json({ error: 'You can’t add documents here.' }, 403)
  const size = Number(request.headers.get('content-length') ?? 0)
  if (!size || size > MAX_UPLOAD) return json({ error: 'Files can be up to 25 MB.' }, 413)
  const type = request.headers.get('content-type') || 'application/octet-stream'
  const key = `${eventId}/${crypto.randomUUID()}`
  await env.FILES.put(key, request.body, { httpMetadata: { contentType: type }, customMetadata: { by: me, name: url.searchParams.get('name') ?? '' } })
  // The full key goes into the document; downloads only work through this event's own route.
  return json({ key, size, type }, 201)
}

async function download(env: Env, me: string, eventId: string, key: string): Promise<Response> {
  const meta = await env.EVENT.getByName(eventId).fileFor(me, key)
  if (!meta) return json({ error: 'Not found' }, 404)
  const obj = await env.FILES?.get(key)
  if (!obj) return json({ error: 'The file is missing.' }, 404)
  const safe = meta.name.replace(/[^\w. -]+/g, '_')
  return new Response(obj.body, {
    headers: {
      'content-type': meta.type,
      'content-disposition': `inline; filename="${safe}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}
