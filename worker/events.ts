// Where events live. Every event is a Durable Object in Cloudflare's EU jurisdiction, so its data
// is stored and processed only in the EU. Events created before that lived in the default
// (global) namespace; `moveToEu` copies them across once.

import type { Env } from './env'

export const eventStub = (env: Env, id: string) =>
  env.EVENT_JURISDICTION === 'eu' ? env.EVENT.jurisdiction('eu').getByName(id)
    // `wrangler dev` has no jurisdictions; "local-eu" stands in with a separate object per event, so the move can be tried.
    : env.EVENT_JURISDICTION === 'local-eu' ? env.EVENT.getByName(`eu:${id}`)
    : env.EVENT.getByName(id)
const legacyStub = (env: Env, id: string) => env.EVENT.getByName(id)

export interface MoveResult { id: string; name: string; result: 'moved' | 'already in EU' | 'nothing to move' | 'mismatch'; records?: number; history?: number }

/**
 * Copies every event that isn't in the EU yet from its old place, then checks the copy holds the
 * same number of records and history entries. The old copy is left untouched (`purge` removes it
 * once the move is confirmed).
 */
export async function moveToEu(env: Env, purge = false): Promise<MoveResult[]> {
  const { results } = await env.DB.prepare('SELECT id, name FROM events ORDER BY created_at').all<{ id: string; name: string }>()
  const out: MoveResult[] = []
  for (const ev of results) {
    const eu = eventStub(env, ev.id)
    const there = await eu.counts()
    if (there.exists) {
      if (purge) await legacyStub(env, ev.id).destroy(true) // the files belong to the EU copy now
      out.push({ id: ev.id, name: ev.name, result: 'already in EU', ...there })
      continue
    }
    const dump = await legacyStub(env, ev.id).dumpRaw()
    if (!dump.meta.some(m => m.key === 'eventId')) { out.push({ id: ev.id, name: ev.name, result: 'nothing to move' }); continue }
    await eu.restore(dump)
    const after = await eu.counts()
    const ok = after.records === dump.docs.length && after.history === dump.audit.length
    out.push({ id: ev.id, name: ev.name, result: ok ? 'moved' : 'mismatch', records: after.records, history: after.history })
  }
  return out
}
