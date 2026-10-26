// Nightly backups: one full backup (every customer and event) per night, kept 30 days, in the
// BACKUPS bucket (EU jurisdiction). Superadmins list and download them; see orgs.ts for the content.
//
//   GET /api/backups          the nightly backups there are, newest first (superadmins)
//   GET /api/backups/:date    download one (superadmins)
//   POST /api/backups/run     make tonight's backup now (superadmins; replaces today's)

import type { Env } from './env'
import { fullBackup, isSuperadmin, json } from './orgs'

const KEEP_DAYS = 30
const key = (date: string) => `nightly/${date}.json`

/** Runs from the cron trigger. Without the bucket (R2 not switched on yet) it only logs. */
export async function nightlyBackup(env: Env, now = Date.now()): Promise<void> {
  if (!env.BACKUPS) { console.log(JSON.stringify({ level: 'warn', what: 'nightly backup skipped: no BACKUPS bucket' })); return }
  const date = new Date(now).toISOString().slice(0, 10)
  const body = JSON.stringify(await fullBackup(env, 'nightly backup'))
  await env.BACKUPS.put(key(date), body, { httpMetadata: { contentType: 'application/json' } })
  // Keep the last 30 nights.
  const cutoff = new Date(now - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
  const old = (await env.BACKUPS.list({ prefix: 'nightly/' })).objects.filter(o => o.key.slice(8, 18) < cutoff).map(o => o.key)
  if (old.length) await env.BACKUPS.delete(old)
  console.log(JSON.stringify({ level: 'info', what: 'nightly backup', date, bytes: body.length, removed: old.length }))
}

export async function backupRoutes(env: Env, me: string, url: URL, method: string): Promise<Response | null> {
  if (url.pathname === '/api/backups/run' && method === 'POST') {
    if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)
    if (!env.BACKUPS) return json({ error: 'Backups need file storage (R2), which isn’t switched on.' }, 503)
    await nightlyBackup(env)
    return json({ ok: true })
  }
  const m = url.pathname.match(/^\/api\/backups(?:\/(\d{4}-\d{2}-\d{2}))?$/)
  if (!m || method !== 'GET') return null
  if (!isSuperadmin(env, me)) return json({ error: 'Only showctrl’s superadmins can do that.' }, 403)
  if (!env.BACKUPS) return json({ enabled: false, backups: [] })
  if (!m[1]) {
    const list = (await env.BACKUPS.list({ prefix: 'nightly/' })).objects
      .map(o => ({ date: o.key.slice(8, 18), bytes: o.size })).sort((a, b) => b.date.localeCompare(a.date))
    return json({ enabled: true, backups: list })
  }
  const obj = await env.BACKUPS.get(key(m[1]))
  if (!obj) return json({ error: 'No backup for that night.' }, 404)
  return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="showctrl-nightly-${m[1]}.json"`, 'cache-control': 'no-store' } })
}
