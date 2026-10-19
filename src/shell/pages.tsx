/*
 * What fills the main area: the access guard, the "no access" and "no event"
 * screens, and the section for the current URL.
 */
import { Link, useParams } from 'react-router-dom'
import { buildSample } from '../data/sample'
import { useSnapshot, useStore } from '../data/hooks'
import { LocalStore } from '../data/localStore'
import { useAccess, useSession } from '../session/hooks'
import { Accommodation } from '../views/Accommodation'
import { Admin } from '../views/Admin'
import { useAdminActions } from '../views/adminActions'
import { ArtistPage } from '../views/ArtistPage'
import { Artists } from '../views/Artists'
import { Clocks } from '../views/Clocks'
import { Display } from '../views/Display'
import { Messages } from '../views/Messages'
import { Overview } from '../views/Overview'
import { Personnel } from '../views/Personnel'
import { Riders } from '../views/Riders'
import { RunSheet } from '../views/RunSheet'
import { Schedule } from '../views/Schedule'
import { StageSetup } from '../views/StageSetup'
import { Today } from '../views/Today'
import { homePath, resolvePage, type Ctx } from './nav'

/** Shown when the viewer may not see a page, with a way back to one they can. */
export function NoAccess({ message }: { message?: string }) {
  const access = useAccess()
  // Someone with no HQ access and no stage role has nothing to go back to.
  const nothing = !access.hqVisible() && access.myStages().length === 0
  return (
    <div className="setup">
      <div className="panel">
        <h2>{message ?? (nothing ? "You don't have access yet" : 'Your access does not include this page')}</h2>
        <p className="muted">
          {nothing ? 'Ask the festival admin or your stage manager to add you.' : 'Ask the festival admin if you need it.'}
        </p>
        {/* "Ask for access" (the requests collection) needs real sign-in, so it comes with the backend. */}
        {!nothing && <Link className="btn primary" to={homePath(access)}>Go to my start page</Link>}
      </div>
    </div>
  )
}

/** No event configured yet. In demo mode, offer the sample festival or a blank event. */
function SetupScreen() {
  const store = useStore()
  const { mode } = useSession()
  const act = useAdminActions()
  return (
    <div className="setup">
      <div className="panel">
        <h2>Create your event</h2>
        <p className="muted">Load a sample five-stage festival to try everything, or start blank: name the event, add stages and appoint a stage manager for each.</p>
        {mode === 'demo' && store instanceof LocalStore && (
          <div className="row">
            <button type="button" className="btn primary" onClick={() => store.reset(buildSample())}>Load the sample festival</button>
            <button type="button" className="btn" onClick={() => act.resetDemo(true)}>Start blank</button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The page for /hq/:view/:arg? and /s/:stageId/:view/:arg?, after the access check. */
export function WorkspacePage({ ctx }: { ctx: Ctx }) {
  const { view = '', arg } = useParams()
  const snap = useSnapshot()
  const access = useAccess()
  const res = resolvePage(access, snap, ctx, view, arg)
  if (res.kind === 'setup') return <SetupScreen />
  if (res.kind === 'denied') return <NoAccess message={res.message} />
  if (view === 'artist') return <ArtistPage ctx={ctx} id={arg!} />
  const sid = ctx === 'hq' ? null : ctx
  switch (`${sid ? 's' : 'hq'}:${view}`) {
    case 'hq:overview': return <Overview />
    case 'hq:schedule': return <Schedule />
    case 'hq:clocks': return <Clocks sid={null} />
    case 'hq:artists': return <Artists sid={null} />
    case 'hq:personnel': return <Personnel sid={null} />
    case 'hq:messages': return <Messages sid={null} />
    case 'hq:accommodation': return <Accommodation />
    case 'hq:riders': return <Riders sid={null} />
    case 's:riders': return <Riders sid={sid} />
    case 's:messages': return <Messages sid={sid} />
    case 's:artists': return <Artists sid={sid} />
    case 's:personnel': return <Personnel sid={sid} />
    case 's:today': return <Today sid={sid!} />
    case 's:runsheet': return <RunSheet sid={sid!} />
    case 's:clocks': return <Clocks sid={sid} />
    case 's:display': return <Display sid={sid!} />
    case 'hq:admin': return <Admin />
    case 's:setup': return <StageSetup sid={sid!} />
  }
  // resolvePage only allows views in the nav, and every nav view is handled above.
  return <NoAccess />
}
