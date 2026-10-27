// Finds out whether a showctrl backend is serving this page. If /api/me answers with JSON,
// we're live (signed in through Cloudflare Access); otherwise the app runs in demo mode.

import { CloudflareStore, type SocketLike } from '../data/cloudflareStore'
import type { Id } from '../types/model'
import type { ImportResult } from '../shared/importSchema'
import type { Analytics } from '../shared/analytics'
import { getLang } from '../i18n'

export interface EventSummary { id: Id; name: string; owner: Id; org?: Id | null }

/** A customer: a folder of events. */
export interface OrgSummary { id: Id; name: string; admin?: boolean }

export interface Me {
  email: Id
  /** Runs the whole showctrl portfolio: creates events and appoints their admins. */
  superadmin?: boolean
  orgs?: OrgSummary[]
  events: EventSummary[]
  lastEvent: Id | null
  canCreate: boolean
  /** The person's chosen typeface (src/shared/fonts.ts). */
  font?: string | null
  /** The name they go by. Null until they give one. */
  name?: string | null
  /** Interface language: 'en' or 'nb'. */
  lang?: string | null
}

export type Backend = { mode: 'demo' } | { mode: 'live'; me: Me } | { mode: 'login' } | { mode: 'error'; message: string }

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
  if (r.status === 401) return { mode: 'login' }
  if (!r.ok || !body?.email) return { mode: 'error', message: body?.error ?? 'Could not sign you in.' }
  return { mode: 'live', me: body }
}

/** A JSON call to the API. Throws the server's message on failure. */
async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(`${path}${devQuery()}`, {
    method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
    ...(init?.body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) }),
    cache: 'no-store',
  })
  const body = await r.json().catch(() => ({})) as T & { error?: string }
  if (!r.ok) throw new Error(body.error ?? 'Something went wrong. Try again.')
  return body
}

/** Superadmins: a new event for a customer, with the people who will run it. */
/** Someone a superadmin names: the email they sign in with, and the name to show until they give their own. */
export interface NamedPerson { email: string; name: string }

export async function createEvent(name: string, sample: boolean, org: Id, admins: NamedPerson[], modules?: string[]): Promise<Id> {
  return (await api<{ id: Id }>('/api/events', { body: { name, sample, org, admins, modules } })).id
}

/** Superadmins: a new customer (a folder of events). */
export async function createOrg(name: string): Promise<Id> {
  return (await api<{ id: Id }>('/api/orgs', { body: { name } })).id
}

export const renameOrg = (id: Id, name: string) => api<{ ok: true }>(`/api/orgs/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } })

/** Superadmins: delete an event and everything in it. */
/** Superadmins: rebuild the sample festival so day 1 is today, at real festival hours. */
export const resetSample = (id: Id) => api<{ ok: true; records: number }>(`/api/events/${encodeURIComponent(id)}/reset-sample`, { method: 'POST', body: {} })
export const deleteEvent = (id: Id) => api<{ ok: true }>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** Superadmins: delete a customer that has no events left. */
export const deleteOrg = (id: Id) => api<{ ok: true }>(`/api/orgs/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** Superadmins: where to download a JSON backup of one event, or (no id) of everything. */
export const backupUrl = (id?: Id) => `${id ? `/api/events/${encodeURIComponent(id)}/backup` : '/api/backup'}${devQuery()}`

export interface NightlyBackups { enabled: boolean; backups: { date: string; bytes: number }[] }

/** Superadmins: the nightly backups kept (last 30 nights), and where to download one. */
export const listNightly = () => api<NightlyBackups>('/api/backups')
export const nightlyUrl = (date: string) => `/api/backups/${date}${devQuery()}`
export const runBackupNow = () => api<{ ok: true }>('/api/backups/run', { method: 'POST', body: {} })

export interface EventAdmins { owner: Id; admins: { email: Id; name: string }[] }

/** Superadmins: who runs an event (Festival admin there, nowhere else). */
export const getEventAdmins = (id: Id) => api<EventAdmins>(`/api/events/${encodeURIComponent(id)}/admins`)

export const addEventAdmin = (id: Id, person: NamedPerson) =>
  api<EventAdmins>(`/api/events/${encodeURIComponent(id)}/admins`, { body: person })

export const removeEventAdmin = (id: Id, email: string) =>
  api<EventAdmins>(`/api/events/${encodeURIComponent(id)}/admins/${encodeURIComponent(email)}`, { method: 'DELETE' })

/** Saves the name you go by; the server copies it into every event you belong to. */
export const saveName = (name: string) => api<{ ok: true }>('/api/me/prefs', { body: { name } })

/** Sign-in step 1: emails a code (if showctrl knows the address). `devCode` only from `wrangler dev`. */
export const startLogin = (email: string) => api<{ ok: true; devCode?: string }>('/api/auth/start', { body: { email, lang: getLang() } })

/** Sign-in step 2: the code from the email. Sets the session cookie. */
export const verifyLogin = (email: string, code: string) => api<{ ok: true }>('/api/auth/verify', { body: { email, code } })

/** Ends this device's session and goes back to the sign-in page. */
/** A sign-in link's token, when the page was opened from one (https://showctrl.no/#signin=…). */
export const linkToken = () => (location.hash.startsWith('#signin=') ? location.hash.slice(8) : null)
export const signInWithLink = (token: string) => api<{ ok: true; email: string }>('/api/auth/link', { body: { token } })
/** Superadmins: a sign-in link to send someone whose email doesn't arrive. Replaces any earlier link. */
export const makeSigninLink = (email: string) => api<{ url: string; expiresAt: number }>('/api/admin/signin-link', { body: { email } })
export const cancelSigninLink = (email: string) => api<{ ok: true }>('/api/admin/signin-link', { method: 'DELETE', body: { email } })

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  location.assign('/')
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
/** Admin → Import: Claude reads the pasted text for the open event. Saves nothing. */
export async function readImport(text: string): Promise<ImportResult> {
  if (!current) throw new Error('Import works only on showctrl.no, not in demo mode.')
  return (await api<{ result: ImportResult }>(`/api/events/${encodeURIComponent(current.id)}/import`, { body: { text } })).result
}

/** Analytics: tells the server which page was opened in the open event, at most every 2 minutes per page. */
const tracked = new Map<string, number>()
export function trackView(where: 'hq' | 'stage', view: string) {
  if (!current) return
  const key = `${current.id}|${where}/${view}`
  const now = Date.now()
  if (now - (tracked.get(key) ?? 0) < 120_000) return
  tracked.set(key, now)
  void fetch(`/api/activity${devQuery()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: current.id, where, view }) }).catch(() => {})
}
export const getAnalytics = (days: number) => api<Analytics>(`/api/analytics?days=${days}`)

export function eventStore(id: Id): CloudflareStore {
  if (current?.id === id) return current.store
  current?.store.dispose()
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${proto}//${location.host}/api/events/${encodeURIComponent(id)}/ws${devQuery()}`
  current = { id, store: new CloudflareStore({ connect: () => new WebSocket(url) as unknown as SocketLike }) }
  return current.store
}
