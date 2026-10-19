/*
 * Festival HQ plus one tab per stage the viewer can see, each marked with
 * its tape colour. A green dot means a show is on; "SM" means you manage it.
 */
import { Link } from 'react-router-dom'
import { useNow } from '../clock/clock'
import { tapeHex, termsOf } from '../domain/constants'
import { nowNext } from '../domain/runsheet'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { hqPath, stagePath, type Ctx } from './nav'
import { colourVar, HQ_COLOUR } from './style'

export function ContextBar({ ctx }: { ctx: Ctx }) {
  const snap = useSnapshot()
  const access = useAccess()
  // Whether a show is on only changes minute to minute.
  const t = useNow(15_000)
  const T = termsOf(snap.cfg)

  return (
    <nav className="ctxbar" aria-label={`Festival HQ and ${T.stages.toLowerCase()}`}>
      {access.hqVisible() && (
        <Link to={hqPath('overview')} aria-current={ctx === 'hq'} style={colourVar(HQ_COLOUR)}>
          Festival HQ
        </Link>
      )}
      {access.visibleStages().map(s => {
        const { cur } = nowNext(snap.col.ros, s.id, t)
        const colour = tapeHex(s.tape)
        return (
          <Link key={s.id} to={stagePath(s.id, 'today')} aria-current={ctx === s.id} style={colourVar(colour)}>
            <span className="tape" style={colourVar(colour)} />
            {s.name}
            {cur?.kind === 'show' && <span className="live" title="Show running" />}
            {access.stageRole(s.id) === 'manager' && <span className="role" title={`You manage this ${T.stage.toLowerCase()}`}>SM</span>}
          </Link>
        )
      })}
    </nav>
  )
}
