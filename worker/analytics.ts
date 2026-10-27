// Analytics for superadmins: who signed in when, and which pages and modules people use.
//
//   POST /api/activity   { event, where: 'hq' | 'stage', view }  the app reports a page it opened
//   GET  /api/analytics?days=30                                 the numbers (superadmins)
//
// Sign-ins are one row each. Page use is counted per person, event, page and day, so a busy
// festival day is a few hundred rows, not one per click. Edits come from each event's own change
// log. Everything older than 13 months is deleted nightly.

import type { Analytics } from '../src/shared/analytics'
import { HQ_VIEWS, STAGE_VIEWS } from '../src/shared/views'
import type { Env } from './env'
import { eventStub } from './events'
import { isSuperadmin, json, mayConnect, superadmins } from './orgs'

const DAY = 86_400_000
const KEEP_DAYS = 400

/** YYYY-MM-DD in Oslo time. */
const osloDay = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(ms)

/** "iPhone · Safari", "Windows · Edge": enough to tell devices apart, nothing more. */
export function deviceOf(ua: string): string {
  const os = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows' : /Linux|CrOS/.test(ua) ? 'Linux' : 'Other'
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other'
  return `${os} · ${br}`
}

/** Called by sign-in when someone signs in. Never fails the sign-in. */
export async function recordSignin(request: Request, env: Env, email: string, method: 'code' | 'link' | 'email-link'): Promise<void> {
  try {
    await env.DB.prepare('INSERT INTO signins (at, email, method, country, device) VALUES (?, ?, ?, ?, ?)')
      .bind(Date.now(), email, method, (request.cf?.country as string | undefined) ?? null, deviceOf(request.headers.get('user-agent') ?? '')).run()
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', what: 'record signin', error: String(e) }))
  }
}

export async function activityRoute(request: Request, env: Env, me: string): Promise<Response> {
  const b = await request.json<{ event?: unknown; where?: unknown; view?: unknown }>().catch(() => ({} as Record<string, unknown>))
  const views: readonly string[] = b.where === 'hq' ? HQ_VIEWS : b.where === 'stage' ? STAGE_VIEWS : []
  if (typeof b.event !== 'string' || typeof b.view !== 'string' || !views.includes(b.view)) return json({ error: 'Unknown page.' }, 400)
  const ev = await env.DB.prepare('SELECT id, owner FROM events WHERE id = ?').bind(b.event).first<{ id: string; owner: string }>()
  if (!ev || !(await mayConnect(env, me, ev))) return json({ error: 'No such event' }, 404)
  const now = Date.now()
  await env.DB.prepare(`INSERT INTO usage_daily (day, email, event_id, view, count, first_at, last_at) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
    ON CONFLICT (day, email, event_id, view) DO UPDATE SET count = count + 1, last_at = ?5`)
    .bind(osloDay(now), me, ev.id, `${b.where}/${b.view}`, now).run()
  return json({ ok: true })
}


export async function analyticsRoute(env: Env, me: string, url: URL): Promise<Response> {
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)
  const days = Math.min(KEEP_DAYS, Math.max(1, Number(url.searchParams.get('days')) || 30))
  const since = Date.now() - days * DAY
  const sinceDay = osloDay(since)
  const [signins, usage, daily, events, names] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare('SELECT at, email, method, country, device FROM signins WHERE at >= ? ORDER BY at DESC LIMIT 1000').bind(since),
    env.DB.prepare(`SELECT email, event_id AS event, view, SUM(count) AS n, COUNT(DISTINCT day) AS days, MAX(last_at) AS last
      FROM usage_daily WHERE day >= ? GROUP BY email, event_id, view`).bind(sinceDay),
    env.DB.prepare('SELECT day, COUNT(DISTINCT email) AS users, SUM(count) AS views FROM usage_daily WHERE day >= ? GROUP BY day ORDER BY day').bind(sinceDay),
    env.DB.prepare('SELECT e.id, e.name, o.name AS org FROM events e LEFT JOIN orgs o ON o.id = e.org_id ORDER BY e.name'),
    env.DB.prepare('SELECT email, name FROM users WHERE name IS NOT NULL'),
  ])
  const evs = events.results as Analytics['events']
  const edits = (await Promise.all(evs.map(async e => (await eventStub(env, e.id).auditSummary(since)).map(r => ({ event: e.id, ...r }))))).flat()
  const body: Analytics = {
    days, superadmins: superadmins(env),
    names: Object.fromEntries((names.results as { email: string; name: string }[]).map(r => [r.email, r.name])),
    events: evs,
    signins: signins.results as Analytics['signins'],
    usage: usage.results as Analytics['usage'],
    daily: daily.results as Analytics['daily'],
    edits,
  }
  return json(body)
}

/** Nightly: forget what's older than 13 months. */
export async function purgeAnalytics(env: Env, now = Date.now()): Promise<void> {
  const before = now - KEEP_DAYS * DAY
  await env.DB.batch([
    env.DB.prepare('DELETE FROM signins WHERE at < ?').bind(before),
    env.DB.prepare('DELETE FROM usage_daily WHERE day < ?').bind(osloDay(before)),
  ])
}
