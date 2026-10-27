import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createDataStore } from '../data/createDataStore'
import { DataProvider } from '../data/DataProvider'
import { useConfig, useStore } from '../data/hooks'
import { LocalStore } from '../data/localStore'
import { blankEvent, buildSample } from '../data/sample'
import type { DataStore } from '../data/store'
import type { Id } from '../types/model'
import { detectBackend, eventStore, linkToken, rememberEvent, saveName, type Backend, type Me } from './backend'
import { EventPicker } from './EventPicker'
import { fontVars, initFont, useFont } from './font'
import { initLang, useLang } from './lang'
import { FONTS } from '../shared/fonts'
import { LinkSignIn, Login } from './Login'
import { NamePrompt } from './YourName'
import { Layout } from './Layout'
import { LiveContext, type Live } from './live'
import { SessionProvider } from './SessionProvider'
import { TimeProvider } from './TimeProvider'
import { ToastProvider } from './ui/ToastProvider'
import { WallContext } from './ui/wall'
import { tr } from '../i18n'
import './showctrl.css'

/**
 * Data, session, shared clock, toasts and layout for every showctrl route.
 * Pass `store` (tests) to skip backend detection; otherwise the app checks for a backend
 * and runs live (Cloudflare) or in demo mode.
 */
export function ShowctrlRoot({ store, initialMe }: { store?: DataStore; initialMe?: Id }) {
  if (store) return <App store={store} initialMe={initialMe} />
  return <Boot />
}

function App({ store, initialMe, isOwner, live }: { store: DataStore; initialMe?: Id; isOwner?: boolean; live?: Live }) {
  return (
    <LiveContext.Provider value={live ?? null}>
      <DataProvider store={store}>
        <SessionProvider initialMe={initialMe} isOwner={isOwner}>
          <TimeProvider>
            <Frame>
              <ToastProvider>
                <EventGate />
              </ToastProvider>
            </Frame>
          </TimeProvider>
        </SessionProvider>
      </DataProvider>
    </LiveContext.Provider>
  )
}

function Boot() {
  const [backend, setBackend] = useState<Backend | null>(null)
  useEffect(() => {
    void detectBackend().then(b => {
      if (b.mode === 'live') { initFont(b.me.font, true); initLang(b.me.lang, true) }
      else if (b.mode === 'demo') { initFont(null, false); initLang(null, false) }
      else initLang(null, false)
      setBackend(b)
    })
  }, [])
  // Opened from a sign-in link: sign in with it first, whoever is signed in now.
  const token = linkToken()
  if (token) return <Frame><LinkSignIn token={token} /></Frame>
  if (!backend) return <Frame><div className="loading">{tr('Connecting…')}</div></Frame>
  if (backend.mode === 'demo') return <App store={demoStore()} />
  if (backend.mode === 'login') return <Frame><Login /></Frame>
  if (backend.mode === 'error') return <Frame><div className="setup"><div className="panel"><h2>{tr('Can’t open showctrl')}</h2><p className="muted">{backend.message}</p></div></div></Frame>
  return <LiveApp me={backend.me} />
}

let demo: DataStore | null = null
/** One demo store for the page's lifetime. */
function demoStore() {
  return (demo ??= createDataStore())
}

/** Live mode: pick an organisation and one of its events (or create one), then connect to it. */
function LiveApp({ me }: { me: Me }) {
  const [events, setEvents] = useState(me.events)
  const [orgs, setOrgs] = useState(me.orgs ?? [])
  const initial = me.lastEvent && me.events.some(e => e.id === me.lastEvent) ? me.lastEvent : me.events.length === 1 ? me.events[0].id : null
  const [eventId, setEventId] = useState<Id | null>(initial)
  // Superadmins browse by customer: the open event's, or the only one there is.
  const [org, setOrg] = useState<Id | null>(() => me.events.find(e => e.id === initial)?.org ?? (orgs.length === 1 ? orgs[0].id : null))
  const open = (id: Id) => {
    rememberEvent(id)
    setOrg(events.find(e => e.id === id)?.org ?? org)
    setEventId(id)
  }
  const [name, setName] = useState(me.name ?? null)
  const live = useMemo<Live>(() => ({
    events, switchEvent: () => setEventId(null),
    name, setName: async (n: string) => { await saveName(n); setName(n.replace(/\s+/g, ' ').trim()) },
    superadmin: !!me.superadmin,
  }), [events, name, me.superadmin])
  if (!eventId) {
    return (
      <LiveContext.Provider value={live}>
      <Frame>
        <NamePrompt />
        <EventPicker
          me={me} orgs={orgs} events={events} org={org} onOrg={setOrg} onOpen={open}
          onCreated={e => { setEvents(list => [{ ...e, owner: me.email }, ...list]); rememberEvent(e.id); setEventId(e.id) }}
          onOrgCreated={o => { setOrgs(list => [...list, o].sort((a, b) => a.name.localeCompare(b.name))); setOrg(o.id) }}
          onOrgRenamed={(id, name) => setOrgs(list => list.map(o => (o.id === id ? { ...o, name } : o)))}
          onDeleted={id => setEvents(list => list.filter(e => e.id !== id))}
          onOrgDeleted={id => { setOrgs(list => list.filter(o => o.id !== id)); setOrg(null) }}
        />
      </Frame>
      </LiveContext.Provider>
    )
  }
  return <LiveEvent id={eventId} me={me.email} live={live} />
}

function LiveEvent({ id, me, live }: { id: Id; me: Id; live: Live }) {
  const store = eventStore(id)
  const getSession = () => store.session
  const session = useSyncExternalStore(useCallback(l => store.onSession(l), [store]), getSession, getSession)
  return <App key={id} store={store} initialMe={session?.me ?? me} isOwner={session?.isOwner ?? false} live={live} />
}

/** The .sc styling root, with wall mode (chrome hidden, full screen). */
function Frame({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false)
  const enter = useCallback(() => {
    setOn(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  const exit = useCallback(() => {
    setOn(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])
  // Leaving full screen with Esc also leaves wall mode.
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setOn(false) }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  const wall = useMemo(() => ({ on, enter, exit }), [on, enter, exit])
  const font = useFont()
  const lang = useLang()
  return (
    <WallContext.Provider value={wall}>
      <div className={`sc${on ? ' wallmode' : ''}`} style={fontVars(FONTS[font])} lang={lang === 'nb' ? 'nb' : 'en'}>
        {/* Changing language redraws everything in the new language (the data stays loaded). */}
        <Fragment key={lang}>{children}</Fragment>
        {on && <button type="button" className="btn exitwall" onClick={exit}>{tr('Exit wall mode')}</button>}
      </div>
    </WallContext.Provider>
  )
}

function EventGate() {
  const cfg = useConfig('event')
  if (cfg === undefined) return <div className="loading">{tr('Connecting…')}</div>
  if (!cfg || cfg.schema !== 2) return <NoEvent />
  return <Layout />
}

/** Shown when the store has no event yet. In demo mode, offer the sample festival or a blank event. */
function NoEvent() {
  const store = useStore()
  if (!(store instanceof LocalStore)) {
    return <div className="setup"><div className="panel"><h2>{tr('This event isn’t set up yet')}</h2><p className="muted">{tr('The festival admin needs to create it first. Check back shortly.')}</p></div></div>
  }
  return (
    <div className="setup">
      <div className="panel">
        <h1>{tr('Create your event')}</h1>
        <p className="muted" style={{ margin: '.5rem 0 1.25rem' }}>{tr('Load a sample five-stage festival to try everything, or start blank: name the event, add stages and appoint a stage manager for each.')}</p>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => store.reset(buildSample())}>{tr('Load sample festival')}</button>
          <button type="button" className="btn" onClick={() => store.reset(blankEvent())}>{tr('Start blank')}</button>
        </div>
      </div>
    </div>
  )
}
