import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DataProvider } from '../data/DataProvider'
import { useConfig, useStore } from '../data/hooks'
import { LocalStore } from '../data/localStore'
import { blankEvent, buildSample } from '../data/sample'
import type { DataStore } from '../data/store'
import type { Id } from '../types/model'
import { Layout } from './Layout'
import { SessionProvider } from './SessionProvider'
import { TimeProvider } from './TimeProvider'
import { ToastProvider } from './ui/ToastProvider'
import { WallContext } from './ui/wall'
import './showctrl.css'

/** Data, session, shared clock, toasts and layout for every showctrl route. */
export function ShowctrlRoot({ store, initialMe }: { store?: DataStore; initialMe?: Id }) {
  return (
    <DataProvider store={store}>
      <SessionProvider initialMe={initialMe}>
        <TimeProvider>
          <Frame>
            <ToastProvider>
              <EventGate />
            </ToastProvider>
          </Frame>
        </TimeProvider>
      </SessionProvider>
    </DataProvider>
  )
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
  return (
    <WallContext.Provider value={wall}>
      <div className={`sc${on ? ' wallmode' : ''}`}>
        {children}
        {on && <button type="button" className="btn exitwall" onClick={exit}>Exit wall mode</button>}
      </div>
    </WallContext.Provider>
  )
}

function EventGate() {
  const cfg = useConfig('event')
  if (cfg === undefined) return <div className="loading">Connecting…</div>
  if (!cfg || cfg.schema !== 2) return <NoEvent />
  return <Layout />
}

/** Shown when the store has no event yet. In demo mode, offer the sample festival or a blank event. */
function NoEvent() {
  const store = useStore()
  if (!(store instanceof LocalStore)) {
    return <div className="setup"><div className="panel"><h2>This event isn’t set up yet</h2><p className="muted">The festival admin needs to create it first. Check back shortly.</p></div></div>
  }
  return (
    <div className="setup">
      <div className="panel">
        <h1>Create your event</h1>
        <p className="muted" style={{ margin: '.5rem 0 1.25rem' }}>Load a sample five-stage festival to try everything, or start blank: name the event, add stages and appoint a stage manager for each.</p>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => store.reset(buildSample())}>Load sample festival</button>
          <button type="button" className="btn" onClick={() => store.reset(blankEvent())}>Start blank</button>
        </div>
      </div>
    </div>
  )
}
