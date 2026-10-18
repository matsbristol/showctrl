import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DataProvider } from '../data/DataProvider'
import { useConfig } from '../data/hooks'
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
  if (!cfg || cfg.schema !== 2) {
    return (
      <div className="setup"><div className="panel"><h2>No event set up yet</h2><p className="muted">Event setup arrives with Admin. Reset the demo to start from the sample festival.</p></div></div>
    )
  }
  return <Layout />
}
