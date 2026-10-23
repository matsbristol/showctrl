// The showctrl Worker: serves the app, the API and the live connection for each event.
//
//   GET  /time                       server time, for clock sync (no sign-in needed)
//   GET  /api/me                     who you are and your events
//   POST /api/events                 create an event { name, sample? }
//   POST /api/me/last-event          remember which event you opened { id }
//   POST /api/events/:id/files       upload a document file (raw body; ?name=&stage=&artist=)
//   GET  /api/events/:id/files/:key  download one, if you may see its document
//   GET  /api/events/:id/ws          WebSocket to the event's Durable Object
//   everything else                  the built app (single-page fallback)

import { blankEvent, buildSample } from '../src/data/sample'
import type { CollectionData } from '../src/server/core'
import { authenticate } from './auth'
import type { Env } from './env'
import { EMAIL_HEADER } from './event'

export { EventObject } from './event'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/time') return json({ now: Date.now() })
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    const auth = await authenticate(request, env)
    if (!auth.ok) return json({ error: auth.message }, auth.status)
    const me = auth.email

    try {
      if (url.pathname === '/api/me' && request.method === 'GET') return await getMe(env, me)
      if (url.pathname === '/api/events' && request.method === 'POST') return await createEvent(request, env, me)
      if (url.pathname === '/api/me/last-event' && request.method === 'POST') {
        const { id } = await request.json<{ id?: string }>()
        if (typeof id !== 'string') return json({ error: 'Missing id' }, 400)
        await env.DB.prepare('INSERT INTO users (email, last_event, seen_at) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO UPDATE SET last_event = ?2, seen_at = ?3')
          .bind(me, id, Date.now()).run()
        return json({ ok: true })
      }
      const up = url.pathname.match(/^\/api\/events\/([\w-]+)\/files$/)
      if (up && request.method === 'POST') return await upload(request, env, me, up[1], url)
      const down = url.pathname.match(/^\/api\/events\/([\w-]+)\/files\/([\w-]+)$/)
      if (down && request.method === 'GET') return await download(env, me, down[1], `${down[1]}/${down[2]}`)
      const ws = url.pathname.match(/^\/api\/events\/([\w-]+)\/ws$/)
      if (ws) {
        if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket' }, 426)
        const ev = await env.DB.prepare('SELECT id FROM events WHERE id = ?').bind(ws[1]).first()
        if (!ev) return json({ error: 'No such event' }, 404)
        // Anyone who got past Access may connect; the event decides what they see
        // (someone without access sees only the stage names and can ask to join).
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

function canCreate(env: Env, me: string): boolean {
  const list = (env.CREATORS ?? '*').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return list.includes('*') || list.includes(me)
}

async function getMe(env: Env, me: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.name, e.owner FROM events e
     WHERE e.owner = ?1 OR e.id IN (SELECT event_id FROM memberships WHERE email = ?1)
     ORDER BY e.created_at DESC`,
  ).bind(me).all<{ id: string; name: string; owner: string }>()
  const user = await env.DB.prepare('SELECT last_event FROM users WHERE email = ?').bind(me).first<{ last_event: string | null }>()
  return json({ email: me, events: results, lastEvent: user?.last_event ?? null, canCreate: canCreate(env, me) })
}

async function createEvent(request: Request, env: Env, me: string): Promise<Response> {
  if (!canCreate(env, me)) return json({ error: 'You can’t create events. Ask whoever runs showctrl for your organisation.' }, 403)
  const body = await request.json<{ name?: string; sample?: boolean }>()
  const name = (body.name ?? '').trim().slice(0, 120) || 'New festival'
  const id = crypto.randomUUID()
  const data = body.sample ? buildSample() : blankEvent()
  // The creator owns the event and is its first admin.
  if (data.cfg) data.cfg = { ...data.cfg, name: body.sample ? data.cfg.name : name }
  delete data.col.members['demo-admin']
  data.col.members[me] = { id: me, name: me, role: 'admin', person: null, depts: [], stages: {} }
  await env.DB.prepare('INSERT INTO events (id, name, owner, created_at) VALUES (?, ?, ?, ?)').bind(id, data.cfg!.name, me, Date.now()).run()
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
