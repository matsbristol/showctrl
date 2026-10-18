import type { ReactNode } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { ShowctrlRoot } from './ShowctrlRoot'
import { ArtistPage, HomeRedirect, HqPage, StagePage } from './pages/Workspace'

/**
 * showctrl's routes, to place inside the app's <Routes>:
 *   /hq                         → the user's start page
 *   /hq/:view                   → Festival HQ pages
 *   /hq/artists/:artistId
 *   /s/:stageId                 → that stage's Today page
 *   /s/:stageId/:view           → stage workspace pages
 *   /s/:stageId/artists/:artistId
 * Pass `root` to supply a custom store or persona (tests).
 */
export function showctrlRoutes(root: ReactNode = <ShowctrlRoot />) {
  return (
    <Route element={root}>
      <Route path="/hq" element={<HomeRedirect />} />
      <Route path="/hq/artists/:artistId" element={<ArtistPage />} />
      <Route path="/hq/:view" element={<HqPage />} />
      <Route path="/s/:stageId" element={<Navigate to="today" replace />} />
      <Route path="/s/:stageId/artists/:artistId" element={<ArtistPage />} />
      <Route path="/s/:stageId/:view" element={<StagePage />} />
    </Route>
  )
}
