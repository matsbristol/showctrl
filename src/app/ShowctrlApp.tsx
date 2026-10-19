/* The new app: data store, session, routes and its stylesheet. */
import { BrowserRouter } from 'react-router-dom'
import { startClockSync } from '../clock/clock'
import { DataProvider } from '../data/DataProvider'
import { SessionProvider } from '../session/SessionProvider'
import { AppRoutes } from '../shell/AppRoutes'
import '../shell/shell.css'
import { store } from './store'

// Runs once, when this module first loads.
startClockSync()

export default function ShowctrlApp() {
  return (
    <DataProvider store={store}>
      <SessionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SessionProvider>
    </DataProvider>
  )
}
