// Finds out whether a showctrl backend is serving this page. If /api/me answers with JSON,
// we're live (signed in through Cloudflare Access); otherwise the app runs in demo mode.

import { CloudflareStore, type SocketLike } from '../data/cloudflareStore'
import type { Id } from '../types/model'

export interface EventSummary { id: Id; name: string; owner: Id }

export interface Me {
  email: Id
  events: EventSummary[]
  lastEvent: Id | null
  canCreate: boolean
}

export type Backend = { mode: 'demo' } | { mode: 'live'; me: Me } | { mode: 'error'; message: string }

/** Local development: `?as=email` signs in as someone else (only honoured by `wrangler dev`). */
function devQuery(): string {
  const as = new URLSearchParams(location.search).get('as')
  return as ? `?as=${encodeURIComponent(as)}` : ''
}

export async function detectBackend(): Promise<Backend> {
  let r: Response
  try {
    r = await fetch(`/api/me${devQuery()}`, { credentials: 'same-origin', cache: 'no-store' })
  } catch {
    return { mode: 'demo' }
  }
  if (!r.headers.get('content-type')?.includes('application/json')) return { mode: 'demo' }
  const body = await r.json().catch(() => null) as (Me & { error?: string }) | null
  if (!r.ok || !body?.email) return { mode: 'error', message: body?.error ?? 'Could not sign you in.' }
  return { mode: 'live', me: body }
}

export async function createEvent(name: string, sample: boolean): Promise<Id> {
  const r = await fetch(`/api/events${devQuery()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, sample }) })
  const body = await r.json() as { id?: Id; error?: string }
  if (!r.ok || !body.id) throw new Error(body.error ?? 'Could not create the event.')
  return body.id
}

/** Remembers the event on the server, so the user's other devices open it too. */
export function rememberEvent(id: Id) {
  void fetch(`/api/me/last-event${devQuery()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
}

let current: { id: Id; store: CloudflareStore } | null = null

/** Uploads a document file for the current event. Returns what to store in the document. */
export async function uploadFile(file: File, scope: { stage?: Id | null; artist?: Id | null }): Promise<{ key: string; size: number; type: string }> {
  if (!current) throw new Error('Not connected to an event.')
  const q = new URLSearchParams({ name: file.name, ...(scope.stage ? { stage: scope.stage } : {}), ...(scope.artist ? { artist: scope.artist } : {}) })
  const as = new URLSearchParams(location.search).get('as')
  if (as) q.set('as', as)
  const r = await fetch(`/api/events/${current.id}/files?${q}`, { method: 'POST', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } })
  const body = await r.json() as { key?: string; size?: number; type?: string; error?: string }
  if (!r.ok || !body.key) throw new Error(body.error ?? 'Upload failed.')
  return { key: body.key, size: body.size!, type: body.type! }
}

/** Where to open a stored document file. */
export function fileUrl(key: string): string {
  if (key.startsWith('data:')) return key
  const [eventId, uuid] = key.split('/')
  return `/api/events/${eventId}/files/${uuid}${devQuery()}`
}

/** The live store for an event. One at a time: opening another event closes the previous connection. */
export function eventStore(id: Id): CloudflareStore {
  if (current?.id === id) return current.store
  current?.store.dispose()
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${proto}//${location.host}/api/events/${encodeURIComponent(id)}/ws${devQuery()}`
  current = { id, store: new CloudflareStore({ connect: () => new WebSocket(url) as unknown as SocketLike }) }
  return current.store
}
