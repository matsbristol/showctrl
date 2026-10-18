import { DataProvider } from '../data/DataProvider'
import { useConfig } from '../data/hooks'
import type { DataStore } from '../data/store'
import type { Id } from '../types/model'
import { Layout } from './Layout'
import { SessionProvider } from './SessionProvider'
import './showctrl.css'

/** Data, session and layout for every showctrl route. */
export function ShowctrlRoot({ store, initialMe }: { store?: DataStore; initialMe?: Id }) {
  return (
    <DataProvider store={store}>
      <SessionProvider initialMe={initialMe}>
        <EventGate />
      </SessionProvider>
    </DataProvider>
  )
}

function EventGate() {
  const cfg = useConfig('event')
  if (cfg === undefined) return <div className="sc"><div className="loading">Connecting…</div></div>
  if (!cfg || cfg.schema !== 2) {
    return (
      <div className="sc">
        <div className="setup"><div className="panel"><h2>No event set up yet</h2><p className="muted">Event setup arrives with Admin. Reset the demo to start from the sample festival.</p></div></div>
      </div>
    )
  }
  return <Layout />
}
