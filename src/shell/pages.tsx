/*
 * What fills the main area: the access guard, the "no access" and "no event"
 * screens, and placeholders for sections that later steps will port.
 */
import { Link, useParams } from 'react-router-dom'
import { LEVELS, termsOf } from '../domain/constants'
import { buildSample } from '../data/sample'
import { useSnapshot, useStore } from '../data/hooks'
import { LocalStore } from '../data/localStore'
import { useAccess, useSession } from '../session/hooks'
import type { Level } from '../types/model'
import { Clocks } from '../views/Clocks'
import { Display } from '../views/Display'
import { Overview } from '../views/Overview'
import { RunSheet } from '../views/RunSheet'
import { Schedule } from '../views/Schedule'
import { Today } from '../views/Today'
import { homePath, resolvePage, VIEW_PERM, type Ctx, type HqView, type StageView } from './nav'

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

/** No event configured yet. In demo mode, offer the sample festival. */
function SetupScreen() {
  const store = useStore()
  const { mode } = useSession()
  return (
    <div className="setup">
      <div className="panel">
        <h2>No event yet</h2>
        <p className="muted">Festival HQ creates the event, adds stages and departments, and appoints a stage manager for each stage.</p>
        {mode === 'demo' && store instanceof LocalStore && (
          <button type="button" className="btn primary" onClick={() => store.reset(buildSample())}>Load the sample festival</button>
        )}
      </div>
    </div>
  )
}

/** Which porting step brings each section still to come (CLAUDE.md, "Port status"). */
const COMING: Partial<Record<HqView | StageView, string>> = {
  artists: 'step 6, with artists and personnel',
  personnel: 'step 6, with artists and personnel',
  messages: 'step 7, messages',
  accommodation: 'step 8, accommodation and riders',
  riders: 'step 8, accommodation and riders',
  admin: 'after step 8, with festival settings',
  setup: 'after step 8, with festival settings',
}

const ACCESS_TEXT: Record<Level, string> = { 0: LEVELS[0], 1: 'You can view this', 2: 'You can edit this' }

function Placeholder({ ctx, view, title }: { ctx: Ctx; view: HqView | StageView; title: string }) {
  const access = useAccess()
  const key = VIEW_PERM[view]
  const sid = ctx === 'hq' ? null : ctx
  const level = Math.max(...(Array.isArray(key) ? key : [key]).map(k => access.lv(k, sid))) as Level
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        <p>Not ported yet: this comes in {COMING[view] ?? 'a later step'}. The prototype at <a href="/showctrl.html">/showctrl.html</a> has it working.</p>
      </div>
      <div className="actions"><span className={`chip ${level >= 2 ? 'go' : ''}`}>{ACCESS_TEXT[level]}</span></div>
    </div>
  )
}

function ArtistPlaceholder({ id }: { id: string }) {
  const snap = useSnapshot()
  const T = termsOf(snap.cfg)
  const a = snap.col.artists[id]
  return (
    <div className="head">
      <div>
        <h1>{a?.name}</h1>
        <p>The {T.performer.toLowerCase()} page comes in step 6, with artists and personnel.</p>
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
  if (view === 'artist') return <ArtistPlaceholder id={arg!} />
  const sid = ctx === 'hq' ? null : ctx
  // Sections ported so far; the rest show a placeholder until their step.
  switch (`${sid ? 's' : 'hq'}:${view}`) {
    case 'hq:overview': return <Overview />
    case 'hq:schedule': return <Schedule />
    case 'hq:clocks': return <Clocks sid={null} />
    case 's:today': return <Today sid={sid!} />
    case 's:runsheet': return <RunSheet sid={sid!} />
    case 's:clocks': return <Clocks sid={sid} />
    case 's:display': return <Display sid={sid!} />
  }
  return <Placeholder ctx={ctx} view={res.item!.view as HqView | StageView} title={res.item!.label} />
}
