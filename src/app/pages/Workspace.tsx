// Route guards for Festival HQ and stage workspaces, ported from renderMain().

import { Navigate, useParams } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { HQ_VIEWS, STAGE_VIEWS, canOpenHqView, canOpenStageView, homePath, type HqView, type StageView } from '../../shared/views'
import { HQ_NAV, STAGE_NAV } from '../nav'
import { useAccess, useTerms } from '../session'
import { AdminPage } from './AdminPage'
import { ClocksPage } from './ClocksPage'
import { DisplayPage } from './DisplayPage'
import { OverviewPage } from './OverviewPage'
import { RunSheetPage } from './RunSheetPage'
import { SchedulePage } from './SchedulePage'
import { TodayPage } from './TodayPage'
import { NoAccess } from './NoAccess'
import { Placeholder } from './Placeholder'

const isHqView = (v: string | undefined): v is HqView => (HQ_VIEWS as readonly string[]).includes(v ?? '')
const isStageView = (v: string | undefined): v is StageView => (STAGE_VIEWS as readonly string[]).includes(v ?? '')

/** `/hq` → the user's start page. */
export function HomeRedirect() {
  return <Navigate to={homePath(useAccess())} replace />
}

/** `/hq/:view` */
export function HqPage() {
  const { view } = useParams()
  const a = useAccess()
  const cfg = useConfig('event')
  if (!a.hqVisible() || !isHqView(view) || !canOpenHqView(a, cfg, view)) return <NoAccess />
  switch (view) {
    case 'admin': return <AdminPage />
    case 'overview': return <OverviewPage />
    case 'schedule': return <SchedulePage />
    case 'clocks': return <ClocksPage sid={null} />
    default: return <Placeholder meta={HQ_NAV[view]} />
  }
}

/** Checks the stage exists and is visible; returns an error page or null. */
function useStageGuard(sid: string | undefined) {
  const a = useAccess()
  const stages = useCollection('stages')
  if (!sid || !stages[sid]) return <NoAccess message="This stage no longer exists." />
  if (!a.canSeeStage(sid)) return <NoAccess message="You don't have access to this stage." />
  return null
}

/** `/s/:stageId/:view` */
export function StagePage() {
  const { stageId, view } = useParams()
  const a = useAccess()
  const cfg = useConfig('event')
  const t = useTerms()
  const stages = useCollection('stages')
  const blocked = useStageGuard(stageId)
  if (blocked) return blocked
  if (!isStageView(view) || !canOpenStageView(a, cfg, stageId!, view)) return <NoAccess />
  const sid = stageId!
  switch (view) {
    case 'today': return <TodayPage sid={sid} />
    case 'runsheet': return <RunSheetPage sid={sid} />
    case 'clocks': return <ClocksPage sid={sid} />
    case 'display': return <DisplayPage sid={sid} />
    default: return <Placeholder meta={STAGE_NAV[view]} sub={`${stages[sid].name} · ${STAGE_NAV[view].about(t)}`} />
  }
}

/** `/hq/artists/:artistId` and `/s/:stageId/artists/:artistId` */
export function ArtistPage() {
  const { stageId, artistId } = useParams()
  const a = useAccess()
  const t = useTerms()
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const blocked = useStageGuard(stageId)
  if (stageId && blocked) return blocked
  const artist = artistId ? artists[artistId] : undefined
  if (!artist) return <NoAccess message={`This ${t.performer.toLowerCase()} no longer exists.`} />
  if (a.lv('artists', artist.stage) < 1) return <NoAccess />
  return (
    <Placeholder
      meta={{ ...STAGE_NAV.artists, label: () => artist.name }}
      sub={`${stages[artist.stage]?.name ?? ''} · ${artist.status}`}
    />
  )
}
