import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import App from './App'
import LandingPage from './pages/LandingPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import ClockDashboardPage from './pages/ClockDashboardPage'
import StagesPage from './pages/StagesPage'
import RunOfShowPage from './pages/RunOfShowPage'
import PerformersPage from './pages/PerformersPage'
import CuesPage from './pages/CuesPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import StageManagerPage from './pages/StageManagerPage'
import HospitalityPage from './pages/HospitalityPage'
import OperationsDashboard from './pages/OperationsDashboard'
import DepartmentStatusPage from './pages/DepartmentStatusPage'
import { ClockProvider } from './context/ClockContext'
import { SettingsProvider } from './context/SettingsContext'
import { RunOfShowProvider } from './context/RunOfShowContext'
import { PerformerReadinessProvider } from './context/PerformerReadinessContext'
import { ModulesProvider } from './context/ModulesContext'
import { CrewProvider } from './context/CrewContext'
import { RiserPlanningProvider } from './context/RiserPlanningContext'
import { TravelProvider } from './context/TravelContext'
import { HospitalityProvider } from './context/HospitalityContext'
import { PerformersContextProvider } from './context/PerformersContext'
import { StagesProvider } from './context/StagesContext'
import { DepartmentStatusProvider } from './context/DepartmentStatusContext'
import { showctrlRoutes } from './app/routes'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
                        <DepartmentStatusProvider>
                      <BrowserRouter>
                        <Routes>
            <Route index element={<Navigate to="/hq" replace />} />
            <Route path="/old" element={<LandingPage />} />
            {showctrlRoutes()}
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
              <Route path="/department-status" element={<DepartmentStatusPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
            </Route>
                        </Routes>
                      </BrowserRouter>
                        </DepartmentStatusProvider>
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
  </React.StrictMode>,
)
