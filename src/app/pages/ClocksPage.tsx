import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { clockValue, sortClocks } from '../../lib/clocks'
import { fmtTime } from '../../lib/time'
import { CLOCK_KINDS, MIN, TAPE } from '../../types/constants'
import type { Clock, Id } from '../../types/model'
import { ClockForm } from '../clocks/ClockForm'
import { useAccess, useNow, useTz } from '../session'
import { useServerTime } from '../time'
import { useWall } from '../ui/wall'

function ClockTile({ c, canEdit, onEdit }: { c: Clock; canEdit: boolean; onEdit: () => void }) {
  const store = useStore()
  const ros = useCollection('ros')
  const stages = useCollection('stages')
  const cfg = useConfig('event')
  const tz = useTz()
  const t = useNow()
  const serverNow = useServerTime()
  const v = clockValue(c, t, { tz, ros, stages })
  const label = c.label || CLOCK_KINDS[c.kind]
  const color = c.kind === 'stage' ? TAPE[stages[c.stage]?.tape ?? 'grey']
    : c.scope ? TAPE[stages[c.scope]?.tape ?? 'grey']
    : c.dept ? TAPE[cfg?.depts.find(d => d.id === c.dept)?.tape ?? 'grey'] : '#3E63FF'

  const timer = async (op: 'start' | 'pause' | 'reset' | 'plus') => {
    if (c.kind !== 'timer') return
    const now = serverNow()
    if (op === 'start') await store.update('clocks', c.id, { runningSince: now })
    if (op === 'pause' && c.runningSince) await store.update('clocks', c.id, { runningSince: null, accum: (c.accum || 0) + (now - c.runningSince) })
    if (op === 'reset') await store.update('clocks', c.id, { runningSince: null, accum: 0 })
    if (op === 'plus') await store.update('clocks', c.id, { duration: (c.duration || 0) + MIN })
  }

  return (
    <article className="tile" style={{ ['--c' as string]: color }}>
      <div className="lab">{label}<span>{c.scope ? stages[c.scope]?.name : 'Festival'}</span></div>
      <div className={`val ${v.state ?? ''}`}>{v.text}</div>
      <div className="sub">{v.sub}</div>
      {canEdit && c.kind === 'timer' && (
        <div className="ctl">
          {c.runningSince
            ? <button type="button" onClick={() => void timer('pause')}>Pause</button>
            : <button type="button" onClick={() => void timer('start')}>{c.accum ? 'Resume' : 'Start'}</button>}
          <button type="button" onClick={() => void timer('reset')}>Reset</button>
          {c.duration ? <button type="button" onClick={() => void timer('plus')}>+1 min</button> : null}
        </div>
      )}
      {canEdit && <button type="button" className="edit" onClick={onEdit} aria-label={`Edit ${label}`}>Edit</button>}
    </article>
  )
}

/** Clocks for HQ (festival-wide plus every visible stage's) or one stage (festival-wide plus its own). */
export function ClocksPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const clocks = useCollection('clocks')
  const stages = useCollection('stages')
  const cfg = useConfig('event')
  const tz = useTz()
  const t = useNow()
  const wall = useWall()
  const [editing, setEditing] = useState<Clock | 'new' | null>(null)
  const list = sortClocks(Object.values(clocks).filter(c => sid ? !c.scope || c.scope === sid : !c.scope || a.canSeeStage(c.scope)))
  const w = a.canW('clocks', sid)

  return (
    <>
      <div className="head">
        <div>
          <h1>Clocks</h1>
          <p>{sid
            ? `Festival-wide clocks plus ${stages[sid]?.name}'s own. Everyone sees the same time, corrected to the server.`
            : 'Shared by every department, corrected to server time. Stage clocks live in each stage.'}</p>
        </div>
        <div className="actions">
          {w && <button type="button" className="btn" onClick={() => setEditing('new')}>+ Add clock</button>}
          <button type="button" className="btn primary" onClick={wall.enter}>Wall mode</button>
        </div>
      </div>
      <div className="wallclock">
        <span className="t">{fmtTime(t, tz, true)}</span>
        <span className="e">{sid ? stages[sid]?.name : cfg?.name}</span>
      </div>
      {list.length ? (
        <div className="wall">
          {list.map(c => (
            <ClockTile key={c.id} c={c} canEdit={a.canW('clocks', c.scope ?? null)} onEdit={() => setEditing(c)} />
          ))}
        </div>
      ) : <div className="panel"><p className="empty">No clocks yet.</p></div>}
      {editing && <ClockForm clock={editing === 'new' ? null : editing} sid={sid} onClose={() => setEditing(null)} />}
    </>
  )
}
