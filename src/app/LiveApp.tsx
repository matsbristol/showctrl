/*
 * Live mode (Supabase): sign in with an email link, pick or create an event,
 * ask for access if you came by an invite link, then the same app as demo
 * mode on a SupabaseStore.
 *
 * The event comes from `?event=<id>` (invite links), else the one used last
 * on this device, else your only event, else a list to choose from.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { Session as AuthSession, SupabaseClient } from '@supabase/supabase-js'
import { BrowserRouter } from 'react-router-dom'
import { DataProvider } from '../data/DataProvider'
import { buildSample } from '../data/sample'
import { SupabaseStore, toStoreError } from '../data/supabaseStore'
import { blankEvent } from '../domain/admin'
import { DEFAULT_ROLES } from '../domain/constants'
import { dayKey } from '../domain/time'
import { now } from '../clock/clock'
import { LiveSessionProvider } from '../session/LiveSessionProvider'
import type { LiveAccount } from '../session/hooks'
import { AppRoutes } from '../shell/AppRoutes'
import type { CollectionName, Snapshot } from '../types/model'
import { FormProvider } from '../ui/FormProvider'
import { ToastProvider } from '../ui/ToastProvider'

const EVENT_KEY = 'showctrl-event'

function savedEvent(): string | null {
  try { return localStorage.getItem(EVENT_KEY) } catch { return null }
}
function saveEvent(id: string | null) {
  try { if (id) localStorage.setItem(EVENT_KEY, id); else localStorage.removeItem(EVENT_KEY) } catch { /* private mode */ }
}

/**
 * `?event=` and `?stage=` from an invite link. The event is remembered; the
 * query stays in the address so it survives the sign-in email being opened.
 */
function readInvite(): { event: string | null; stage: string | null } {
  const q = new URLSearchParams(location.search)
  const event = q.get('event')
  const stage = q.get('stage')
  if (event) saveEvent(event)
  return { event, stage }
}

export default function LiveApp({ sb }: { sb: SupabaseClient }) {
  const [auth, setAuth] = useState<AuthSession | null | undefined>(undefined)
  const [invite] = useState(readInvite)
  const [eventId, setEventId] = useState<string | null>(() => invite.event ?? savedEvent())

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setAuth(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setAuth(s))
    return () => data.subscription.unsubscribe()
  }, [sb])

  const choose = useCallback((id: string | null) => {
    saveEvent(id)
    setEventId(id)
  }, [])

  if (auth === undefined) return null
  if (!auth) return <SignIn sb={sb} />
  if (!eventId) return <EventList sb={sb} auth={auth} onPick={choose} />
  return <EventApp key={eventId} sb={sb} auth={auth} eventId={eventId} stage={invite.stage} onLeave={() => choose(null)} />
}

/* ---------------- sign in ---------------- */

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="setup">
      <div className="panel">
        <div className="brand"><i />showctrl</div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Email magic link: no passwords to remember backstage. */
function SignIn({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    // Come back to the same address, so an invite link survives signing in.
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.href } })
    setState(error ? error.message : 'sent')
  }

  if (state === 'sent') {
    return (
      <Screen title="Check your email">
        <p>We sent a sign-in link to <b>{email}</b>. Open it on this device.</p>
        <button type="button" className="btn" onClick={() => setState('idle')}>Use another address</button>
      </Screen>
    )
  }
  return (
    <Screen title="Sign in">
      <p className="muted">Enter your email and we’ll send you a link to sign in.</p>
      <form className="stack live-form" onSubmit={submit}>
        <div className="fld full"><label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {state !== 'idle' && state !== 'sending' && <p className="small err" role="alert">{state}</p>}
        <button type="submit" className="btn primary" disabled={state === 'sending'}>Send sign-in link</button>
      </form>
    </Screen>
  )
}

const displayName = (auth: AuthSession) =>
  (auth.user.user_metadata?.name as string | undefined) || auth.user.email?.split('@')[0] || 'Me'

/* ---------------- choose or create an event ---------------- */

interface EventRow { id: string; cfg: { name?: string; start?: string; end?: string } | null }

function EventList({ sb, auth, onPick }: { sb: SupabaseClient; auth: AuthSession; onPick: (id: string) => void }) {
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Row-level security returns only events this user takes part in.
    void sb.from('events').select('id, cfg').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setError(toStoreError(error).message)
      else setEvents((data ?? []) as EventRow[])
    })
  }, [sb])

  if (error) return <Screen title="Something went wrong"><p className="err">{error}</p></Screen>
  if (!events) return null
  return (
    <Screen title={events.length ? 'Your events' : 'Create your first event'}>
      {events.length > 0 && (
        <ul className="list live-events">
          {events.map(e => (
            <li key={e.id}>
              <button type="button" className="btn" onClick={() => onPick(e.id)}>{e.cfg?.name || 'Untitled event'}</button>
              <span className="small muted">{[e.cfg?.start, e.cfg?.end].filter(Boolean).join(' – ')}</span>
            </li>
          ))}
        </ul>
      )}
      <CreateEvent sb={sb} auth={auth} onCreated={onPick} />
      <p className="small muted">Signed in as {auth.user.email} · <button type="button" className="link" onClick={() => void sb.auth.signOut()}>Sign out</button></p>
    </Screen>
  )
}

/** Collections copied from the sample festival, in an order that lets the access rules find each record's stage. */
const SEED_ORDER: CollectionName[] = ['stages', 'people', 'members', 'stageteam', 'artists', 'ros', 'clocks', 'hotels', 'bookings', 'riders']

/**
 * Creates the event (and an organisation for it) with the creator as owner
 * and Festival admin. Optionally fills it with the sample festival, minus
 * messages, which can only be sent as yourself.
 */
function CreateEvent({ sb, auth, onCreated }: { sb: SupabaseClient; auth: AuthSession; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [sample, setSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data: Snapshot | null = sample ? buildSample() : null
      const cfg = { ...(data?.cfg ?? blankEvent(dayKey(now()))), name: name.trim() || data?.cfg?.name || 'New festival' }
      const { data: id, error } = await sb.rpc('create_event', {
        org: null, org_name: org.trim(), cfg, roles: data?.roles ?? DEFAULT_ROLES, my_name: displayName(auth),
      })
      if (error) throw toStoreError(error)
      if (data) {
        const store = new SupabaseStore(sb, id as string)
        for (const c of SEED_ORDER) await store.setMany(c, Object.values(data.col[c]) as never[])
      }
      onCreated(id as string)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event.')
      setBusy(false)
    }
  }

  return (
    <form className="stack live-form" onSubmit={submit}>
      <h3>New event</h3>
      <div className="fld full"><label htmlFor="ev-name">Event name</label>
        <input id="ev-name" value={name} onChange={e => setName(e.target.value)} placeholder="New festival" />
      </div>
      <div className="fld full"><label htmlFor="ev-org">Organisation</label>
        <input id="ev-org" value={org} onChange={e => setOrg(e.target.value)} placeholder="My organisation" />
      </div>
      <label className="row"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)} /> Fill it with the sample five-stage festival</label>
      {error && <p className="small err" role="alert">{error}</p>}
      <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
    </form>
  )
}

/* ---------------- the event ---------------- */

function EventApp({ sb, auth, eventId, stage, onLeave }: {
  sb: SupabaseClient; auth: AuthSession; eventId: string; stage: string | null; onLeave: () => void
}) {
  const store = useMemo(() => new SupabaseStore(sb, eventId), [sb, eventId])
  const [state, setState] = useState<'loading' | 'ready' | 'no-access' | string>('loading')

  // Loads the event; state starts as 'loading', so the effect needn't set it.
  const load = useCallback(() => {
    store.start()
      .then(ok => setState(ok ? 'ready' : 'no-access'))
      .catch(e => setState(e instanceof Error ? e.message : 'Could not load the event.'))
  }, [store])

  const start = () => {
    store.stop()
    setState('loading')
    load()
  }

  useEffect(() => {
    load()
    return () => store.stop()
  }, [store, load])

  const account = useMemo<LiveAccount>(() => ({
    email: auth.user.email ?? '',
    eventId,
    signOut: () => { saveEvent(null); void sb.auth.signOut() },
    switchEvent: onLeave,
  }), [auth, eventId, sb, onLeave])

  if (state === 'loading') return null
  if (state === 'no-access') return <AskAccess sb={sb} auth={auth} eventId={eventId} stage={stage} onRetry={start} onLeave={onLeave} />
  if (state !== 'ready') {
    return (
      <Screen title="Couldn’t load the event">
        <p className="err">{state}</p>
        <div className="row"><button type="button" className="btn primary" onClick={start}>Try again</button><button type="button" className="btn" onClick={onLeave}>Your events</button></div>
      </Screen>
    )
  }
  return (
    <DataProvider store={store}>
      <LiveSessionProvider uid={auth.user.id} isOwner={store.owner === auth.user.id} account={account}>
        <ToastProvider>
          <FormProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </FormProvider>
        </ToastProvider>
      </LiveSessionProvider>
    </DataProvider>
  )
}

/**
 * Signed in, but no access to this event yet: send a request to join
 * (`requests/<uid>`), which admins see under Admin › Access and, with a
 * stage in the link, that stage's managers see in Stage setup.
 */
function AskAccess({ sb, auth, eventId, stage, onRetry, onLeave }: {
  sb: SupabaseClient; auth: AuthSession; eventId: string; stage: string | null; onRetry: () => void; onLeave: () => void
}) {
  const [eventName, setEventName] = useState<string | null | undefined>(undefined)
  const [name, setName] = useState(displayName(auth))
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle')

  useEffect(() => {
    void sb.rpc('event_name', { ev: eventId }).then(({ data }) => setEventName((data as string | null) ?? null))
  }, [sb, eventId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const doc = { at: now(), note: note.trim(), name: name.trim(), email: auth.user.email, ...(stage ? { stage } : {}) }
    const { error } = await sb.from('docs').upsert({ event_id: eventId, col: 'requests', id: auth.user.id, doc })
    setState(error ? toStoreError(error).message : 'sent')
  }

  if (eventName === undefined) return null
  if (eventName === null) {
    return (
      <Screen title="Event not found">
        <p className="muted">This link doesn’t lead to an event. Ask whoever sent it for a new one.</p>
        <button type="button" className="btn" onClick={onLeave}>Your events</button>
      </Screen>
    )
  }
  if (state === 'sent') {
    return (
      <Screen title="Request sent">
        <p>An admin of <b>{eventName}</b> will see your request. You’ll get in once they give you access.</p>
        <div className="row"><button type="button" className="btn primary" onClick={onRetry}>Check again</button><button type="button" className="btn" onClick={onLeave}>Your events</button></div>
      </Screen>
    )
  }
  return (
    <Screen title={`Ask to join ${eventName}`}>
      <p className="muted">You don’t have access to this event yet. Send a request and an admin will let you in.</p>
      <form className="stack live-form" onSubmit={submit}>
        <div className="fld full"><label htmlFor="rq-name">Your name</label>
          <input id="rq-name" required value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="fld full"><label htmlFor="rq-note">Who you are (role, company)</label>
          <input id="rq-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Monitor engineer, Main Stage" />
        </div>
        {state !== 'idle' && state !== 'sending' && <p className="small err" role="alert">{state}</p>}
        <button type="submit" className="btn primary" disabled={state === 'sending'}>Ask for access</button>
      </form>
      <p className="small muted">Signed in as {auth.user.email} · <button type="button" className="link" onClick={() => void sb.auth.signOut()}>Sign out</button></p>
    </Screen>
  )
}
