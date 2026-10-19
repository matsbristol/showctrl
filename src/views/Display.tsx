/*
 * On-stage display, for the stage monitor or a tablet side stage. Follows
 * the run sheet, delays included: time left of what's on, else time to the
 * next show. Amber in the last 10 minutes of a show (5 otherwise), red over.
 */
import { useNow } from '../clock/clock'
import { cdState, fmtCountdown } from '../domain/clocks'
import { KINDS, MIN, tapeHex } from '../domain/constants'
import { eff, nowNext } from '../domain/runsheet'
import { fmtTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { Icon } from '../shell/Icon'
import { colourVar } from '../shell/style'
import type { Id } from '../types/model'
import { useWallMode } from '../ui/wall'
import { useEvent } from './hooks'

export function Display({ sid }: { sid: Id }) {
  const snap = useSnapshot()
  const { tz, T } = useEvent()
  const t = useNow(250)
  const wall = useWallMode()
  const stage = snap.col.stages[sid]
  const { cur, next } = nowNext(snap.col.ros, sid, t)

  let label: string
  let who = ''
  let target: number | null = null
  let warn = 5
  let on = false
  if (cur) {
    on = cur.kind === 'show'
    label = on ? `On ${T.stage.toLowerCase()} — time left` : `${KINDS[cur.kind].label} — time left`
    // During a changeover, the crew wants to know who is coming on.
    who = cur.kind === 'changeover' && next ? `Next: ${next.title}` : cur.title
    target = eff(cur).e
    warn = on ? 10 : 5
  } else if (next) {
    label = `Next on ${T.stage.toLowerCase()} in`
    who = next.title
    target = eff(next).s
  } else {
    label = 'No more shows today'
  }
  const ms = target == null ? null : target - t
  const running = cur ?? next
  const delay = running?.delay ?? 0

  return (
    <>
      <div className="head">
        <div>
          <h1>{T.stage} display</h1>
          <p>Put this on the {T.stage.toLowerCase()} monitor or a tablet side stage. It follows the run sheet, including delays.</p>
        </div>
        <div className="actions"><button type="button" className="btn primary" onClick={wall.enter}><Icon name="full" />Full screen</button></div>
      </div>
      <div className="display" style={colourVar(tapeHex(stage.tape))}>
        <div className="top"><span className="st">{stage.name}</span><span className="tod">{fmtTime(t, true, tz)}</span></div>
        <div className="mid">
          <span className={`lbl ${on ? 'on' : ''}`}>{label}</span>
          <span className="dwho">{who}</span>
          {ms != null && <span className={`big ${cdState(ms, warn)}`}>{fmtCountdown(ms)}</span>}
        </div>
        <div className="bot">
          {cur && <span>Ends <b>{fmtTime(eff(cur).e, false, tz)}</b></span>}
          {next && <span>Next <b>{next.title}</b> at <b>{fmtTime(eff(next).s, false, tz)}</b></span>}
          {delay !== 0 && <span>Running <b>{Math.round(Math.abs(delay) / MIN)} min</b> {delay > 0 ? 'late' : 'early'}</span>}
        </div>
      </div>
      {wall.on && <button type="button" className="btn exitwall" onClick={wall.exit}>Exit full screen</button>}
    </>
  )
}
