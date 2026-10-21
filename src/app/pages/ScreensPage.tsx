import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { SCREEN_BLOCKS, TAPE } from '../../types/constants'
import type { Id, Screen } from '../../types/model'
import { ScreenForm } from '../screens/ScreenForm'
import { ScreenView } from '../screens/ScreenView'
import { useAccess, useTerms } from '../session'
import { useWall } from '../ui/wall'
import { NoAccess } from './NoAccess'

/** The list of screens for HQ (all of them) or one stage (its own and HQ's). */
export function ScreensPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const screens = useCollection('screens')
  const stages = useCollection('stages')
  const [editing, setEditing] = useState<Screen | 'new' | null>(null)
  const base = sid ? `/s/${sid}` : '/hq'
  const list = Object.values(screens)
    .filter(s => (sid ? !s.scope || s.scope === sid : !s.scope || a.canSeeStage(s.scope)))
    .sort((x, y) => (x.scope ? 1 : 0) - (y.scope ? 1 : 0) || (x.order ?? 0) - (y.order ?? 0) || x.name.localeCompare(y.name))
  const canAdd = a.canW('clocks', sid)
  return (
    <>
      <div className="head">
        <div>
          <h1>Screens</h1>
          <p>One layout per monitor: the production office, an FOH desk, the dock gate. Open a screen on the computer driving that monitor and press full screen.</p>
        </div>
        {canAdd && <div className="actions"><button type="button" className="btn primary" onClick={() => setEditing('new')}>+ Add screen</button></div>}
      </div>
      <div className="grid g3">
        {list.map(s => {
          const follows = s.stages.length ? s.stages.map(id => stages[id]).filter(Boolean) : null
          return (
            <section key={s.id} className="panel screen-card">
              <div className="ph">
                <h3>{s.name}</h3>
                <span className="small muted">{s.scope ? stages[s.scope]?.name : 'HQ'}</span>
              </div>
              <div className="pb stack small">
                <span className="row">
                  {follows ? follows.map(st => <span key={st.id} className="row"><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />{st.name}</span>) : <span>Every {t.stage.toLowerCase()}</span>}
                </span>
                <span className="muted">{s.blocks.map(b => SCREEN_BLOCKS[b]).join(' · ')}</span>
              </div>
              <div className="pb row" style={{ paddingTop: 0 }}>
                <Link className="btn primary sm" to={`${base}/screens/${s.id}`}>Open</Link>
                {a.canW('clocks', s.scope ?? null) && <button type="button" className="btn sm" onClick={() => setEditing(s)}>Edit</button>}
              </div>
            </section>
          )
        })}
        {!list.length && <div className="panel"><p className="empty">No screens yet.{canAdd && ' Add one for each monitor you want to drive.'}</p></div>}
      </div>
      {editing && <ScreenForm screen={editing === 'new' ? null : editing} sid={sid} onClose={() => setEditing(null)} />}
    </>
  )
}

/** `/hq/screens/:screenId` and `/s/:stageId/screens/:screenId`: one screen, ready to go full screen. */
export function ScreenPage() {
  const { screenId } = useParams()
  const screens = useCollection('screens')
  const wall = useWall()
  const screen = screenId ? screens[screenId] : undefined
  if (!screen) return <NoAccess message="This screen no longer exists." />
  return (
    <>
      <div className="head">
        <div><h1>{screen.name}</h1><p>Updates live. Full screen hides everything else; press Esc to come back.</p></div>
        <div className="actions"><button type="button" className="btn primary" onClick={wall.enter}>Full screen</button></div>
      </div>
      <ScreenView screen={screen} />
    </>
  )
}
