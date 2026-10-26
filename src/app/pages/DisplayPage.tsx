import { Fragment, type ReactNode } from 'react'
import { useCollection } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { countdownState, fmtCountdown, fmtTime } from '../../lib/time'
import { MIN, TAPE } from '../../types/constants'
import type { Id } from '../../types/model'
import { kindLabel, useNowNext } from '../runsheet/helpers'
import { useNow, useTz } from '../session'
import { useWall } from '../ui/wall'
import { tr } from '../../i18n'

/** Fills `{name}` placeholders in a translated text with elements (e.g. bold times). */
function rich(text: string, parts: Record<string, ReactNode>): ReactNode[] {
  return text.split(/\{(\w+)\}/).map((p, i) => (i % 2 ? <Fragment key={i}>{parts[p]}</Fragment> : p))
}

/** Full-screen now and next for the stage monitor. Follows the run sheet, including delays. */
export function DisplayPage({ sid }: { sid: Id }) {
  const stages = useCollection('stages')
  const tz = useTz()
  const t = useNow()
  const wall = useWall()
  const { cur, next } = useNowNext(sid)
  const st = stages[sid]

  let lbl: string, who: string, target: number | null, warn = 5, on = false
  if (cur) {
    on = cur.kind === 'show'
    lbl = on ? tr('On stage — time left') : tr('{kind} — time left', { kind: kindLabel(cur.kind) })
    who = cur.kind === 'changeover' && next ? tr('Next: {title}', { title: next.title }) : cur.title
    target = eff(cur).e
    warn = on ? 10 : 5
  } else if (next) {
    lbl = tr('Next on stage in'); who = next.title; target = eff(next).s
  } else {
    lbl = tr('No more shows today'); who = ''; target = null
  }
  const ms = target == null ? null : target - t
  const running = (cur ?? next)?.delay ?? 0

  return (
    <>
      <div className="head">
        <div><h1>{tr('Stage display')}</h1><p>{tr('Put this on the stage monitor or a tablet side stage. It follows the run sheet, including delays.')}</p></div>
        <div className="actions"><button type="button" className="btn primary" onClick={wall.enter}>{tr('Full screen')}</button></div>
      </div>
      <div className="display" style={{ ['--c' as string]: TAPE[st.tape] }}>
        <div className="top"><span className="st">{st.name}</span><span className="tod">{fmtTime(t, tz, true)}</span></div>
        <div className="mid">
          <span className={`lbl${on ? ' on' : ''}`}>{lbl}</span>
          <span className="dwho">{who}</span>
          <span className={`big ${ms == null ? '' : countdownState(ms, warn)}`} aria-live="off">{ms == null ? '' : fmtCountdown(ms)}</span>
        </div>
        <div className="bot">
          {cur && <span>{rich(tr('Ends {time}'), { time: <b>{fmtTime(eff(cur).e, tz)}</b> })}</span>}
          {next && <span>{rich(tr('Next {title} at {time}'), { title: <b>{next.title}</b>, time: <b>{fmtTime(eff(next).s, tz)}</b> })}</span>}
          {running ? <span>{rich(running > 0 ? tr('Running {n} late') : tr('Running {n} early'), { n: <b>{Math.round(Math.abs(running) / MIN)} min</b> })}</span> : null}
        </div>
      </div>
    </>
  )
}
