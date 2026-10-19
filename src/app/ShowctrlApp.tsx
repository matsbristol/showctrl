/*
 * The app: live mode on Supabase when it is configured (see data/supabase.ts),
 * otherwise demo mode on the sample festival in this browser.
 */
import { lazy } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { startClockSync } from '../clock/clock'
import { DataProvider } from '../data/DataProvider'
import { serverClock, supabase } from '../data/supabase'
import { SessionProvider } from '../session/SessionProvider'
import { AppRoutes } from '../shell/AppRoutes'
import { FormProvider } from '../ui/FormProvider'
import { ToastProvider } from '../ui/ToastProvider'
import '../shell/shell.css'
import { demoStore } from './store'

const LiveApp = lazy(() => import('./LiveApp'))

// Runs once, when this module first loads. Live mode takes the time from the
// database; demo mode from this page's Date header.
startClockSync(supabase ? serverClock(supabase) : undefined)

export default function ShowctrlApp() {
  if (supabase) return <LiveApp sb={supabase} />
  return (
    <DataProvider store={demoStore()}>
      <SessionProvider>
        <ToastProvider>
          <FormProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </FormProvider>
        </ToastProvider>
      </SessionProvider>
    </DataProvider>
  )
}
