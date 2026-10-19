/*
 * Routes for the new app. Each workspace (HQ, or one stage) shares the shell:
 * strip, context bar, side nav, then the page.
 */
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { useAccess } from '../session/hooks'
import { ContextBar } from './ContextBar'
import { homePath, type Ctx } from './nav'
import { WorkspacePage } from './pages'
import { SideNav } from './SideNav'
import { TopStrip } from './TopStrip'
import { UrgentBanner } from './UrgentBanner'

function Shell({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <TopStrip />
      <ContextBar ctx={ctx} />
      <UrgentBanner />
      <div className="shell">
        <SideNav ctx={ctx} />
        <main>
          <Outlet />
        </main>
      </div>
    </>
  )
}

function StageShell() {
  const { stageId = '' } = useParams()
  return <Shell ctx={stageId} />
}

function StagePage() {
  const { stageId = '' } = useParams()
  return <WorkspacePage ctx={stageId} />
}

/** Sends people to HQ if they can see it, otherwise to their own stage. */
function Home() {
  const access = useAccess()
  return <Navigate to={homePath(access)} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/hq" element={<Shell ctx="hq" />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path=":view/:arg?" element={<WorkspacePage ctx="hq" />} />
      </Route>
      <Route path="/s/:stageId" element={<StageShell />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path=":view/:arg?" element={<StagePage />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
