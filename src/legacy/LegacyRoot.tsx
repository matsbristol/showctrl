/*
 * The September React app, kept reachable at /legacy while its screens are
 * replaced by the port of the prototype. Its absolute links (/events,
 * /stages, ...) stay inside /legacy because of the router basename.
 * Delete this file and the old contexts/pages once the port covers them.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from '../App'
import LandingPage from '../pages/LandingPage'
import EventsPage from '../pages/EventsPage'
import EventDetailPage from '../pages/EventDetailPage'
import ClockDashboardPage from '../pages/ClockDashboardPage'
import StagesPage from '../pages/StagesPage'
import RunOfShowPage from '../pages/RunOfShowPage'
import PerformersPage from '../pages/PerformersPage'
import CuesPage from '../pages/CuesPage'
import AdminSettingsPage from '../pages/AdminSettingsPage'
import StageManagerPage from '../pages/StageManagerPage'
import HospitalityPage from '../pages/HospitalityPage'
import OperationsDashboard from '../pages/OperationsDashboard'
import { ClockProvider } from '../context/ClockContext'
import { SettingsProvider } from '../context/SettingsContext'
import { RunOfShowProvider } from '../context/RunOfShowContext'
import { PerformerReadinessProvider } from '../context/PerformerReadinessContext'
import { ModulesProvider } from '../context/ModulesContext'
import { CrewProvider } from '../context/CrewContext'
import { RiserPlanningProvider } from '../context/RiserPlanningContext'
import { TravelProvider } from '../context/TravelContext'
import { HospitalityProvider } from '../context/HospitalityContext'
import { PerformersContextProvider } from '../context/PerformersContext'
import { StagesProvider } from '../context/StagesContext'
import '../index.css'

export default function LegacyRoot() {
  return (
        <SettingsProvider>
        <PerformersContextProvider>
          <StagesProvider>
          <ClockProvider>
            <RunOfShowProvider>
              <PerformerReadinessProvider>
                <ModulesProvider>
                  <CrewProvider>
                    <RiserPlanningProvider>
                      <TravelProvider>
                        <HospitalityProvider>
                        <BrowserRouter basename="/legacy">
                          <Routes>
              <Route index element={<LandingPage />} />
              <Route element={<App />}>
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:eventId" element={<EventDetailPage />} />
                <Route path="/clocks" element={<ClockDashboardPage />} />
                <Route path="/stage-manager" element={<StageManagerPage />} />
                <Route path="/stages" element={<StagesPage />} />
                <Route path="/runofshow" element={<RunOfShowPage />} />
                <Route path="/performers" element={<PerformersPage />} />
                <Route path="/cues" element={<CuesPage />} />
                <Route path="/hospitality" element={<HospitalityPage />} />
                <Route path="/operations" element={<OperationsDashboard />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
              </Route>
                          </Routes>
                        </BrowserRouter>
                      </HospitalityProvider>
                    </TravelProvider>
                  </RiserPlanningProvider>
                </CrewProvider>
              </ModulesProvider>
            </PerformerReadinessProvider>
          </RunOfShowProvider>
        </ClockProvider>
        </StagesProvider>
        </PerformersContextProvider>
      </SettingsProvider>
  )
}
