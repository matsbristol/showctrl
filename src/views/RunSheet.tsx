/*
 * A stage's run sheet: everything from get in to load out, as a two-lane
 * timeline (on stage / dock & backstage) and a table with the live controls.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MIN, tapeHex, TRACKS } from '../domain/constants'
import { eff, itemsFor, track } from '../domain/runsheet'
import { fmtTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { Icon } from '../shell/Icon'
import { stagePath } from '../shell/nav'
import type { Id } from '../types/model'
import { DaySeg, Head, KindTag } from './common'
import { useDay, useEvent } from './hooks'
import { Lanes } from './Lanes'
import { useRunsheetActions } from './runsheetActions'

/** 'all', 'stage', 'dock', or an artist id. */
type Filter = string

export function RunSheet({ sid }: { sid: Id }) {
  const snap = useSnapshot()
  const access = useAccess()
  const { tz, T } = useEvent()
  const { day } = useDay()
  const act = useRunsheetActions()
  const [filter, setFilter] = useState<Filter>('all')
  const [hideDone, setHideDone] = useState(true)
  const stage = snap.col.stages[sid]
  const canEdit = access.canW('schedule', sid)

  const all = itemsFor(snap.col.ros, sid, { day, tz })
  const lanes = [
    { label: TRACKS.stage, items: all.filter(i => track(i) === 'stage'), tape: tapeHex(stage.tape), short: true },
    { label: TRACKS.dock, items: all.filter(i => track(i) === 'dock'), tape: 'var(--ink3)' },
  ]
  const artistIds = [...new Set(all.map(i => i.artist).filter(Boolean))] as Id[]
  const list = all.filter(i =>
    (!hideDone || i.status !== 'done') &&
    (filter === 'all' || (filter === 'stage' ? track(i) === 'stage' : filter === 'dock' ? track(i) === 'dock' : i.artist === filter)))

  return (
    <>
      <Head
        title={`Run sheet · ${stage.name}`}
        sub="Everything from get in to load out. A delay pushes everything after it and updates every clock and display."
        actions={<>
          <DaySeg />
          {canEdit && <>
            <button type="button" className="btn" onClick={() => act.editItem({}, day, sid)}><Icon name="plus" />Add item</button>
            <button type="button" className="btn primary" onClick={() => act.daySheet(sid, day)}><Icon name="plus" />Generate day sheet</button>
          </>}
        </>}
      />
      <Lanes lanes={lanes} day={day} onEdit={canEdit ? i => act.editItem(i, day) : undefined} />

      <div className="filters">
        <label className="small muted" htmlFor="rs-filter">Show</label>
        <select id="rs-filter" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Everything</option>
          <option value="stage">On {T.stage.toLowerCase()} only</option>
          <option value="dock">Dock &amp; backstage only</option>
          {artistIds.map(a => <option key={a} value={a}>{snap.col.artists[a]?.name ?? a}</option>)}
        </select>
        <label className="row small"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} /> Hide finished</label>
        {canEdit && all.some(i => i.delay) && <button type="button" className="btn sm" onClick={() => act.resetDay(sid, day)}>Back on planned times</button>}
      </div>

      <section className="panel">
        {list.length ? (
          <div className="tbl-wrap">
            <table className="ro">
              <thead><tr><th>Time</th><th>Activity</th><th /><th /></tr></thead>
              <tbody>
                {list.map(i => {
                  const e = eff(i)
                  return (
                    <tr key={i.id} className={i.status}>
                      <td className="t">
                        {i.delay ? <s>{fmtTime(i.start, false, tz)}</s> : null}
                        <b>{fmtTime(e.s, false, tz)}</b>{e.e - e.s >= 5 * MIN && `–${fmtTime(e.e, false, tz)}`}
                      </td>
                      <td>
                        <KindTag kind={i.kind} />
                        <b>{i.artist ? <Link to={stagePath(sid, 'artist', i.artist)} className="plain">{i.title}</Link> : i.title}</b>
                        <div className="small muted">
                          {TRACKS[track(i)]}{i.notes && ` · ${i.notes}`}{i.delayNote && ` · Delay: ${i.delayNote}`}
                        </div>
                      </td>
                      <td>{i.status === 'live' ? <span className="chip go">Live</span> : i.status === 'done' ? <span className="chip">Done</span> : null}</td>
                      <td>
                        {canEdit && (
                          <div className="acts">
                            {i.status === 'live'
                              ? <button type="button" className="btn sm" onClick={() => act.finish(i)}>Done</button>
                              : i.status !== 'done' && <button type="button" className="btn sm go" onClick={() => act.start(i)}>{i.kind === 'show' ? `On ${T.stage.toLowerCase()}` : 'Start'}</button>}
                            {i.status !== 'done' && <button type="button" className="btn sm" onClick={() => act.delay(i)}>Delay</button>}
                            <button type="button" className="btn sm" onClick={() => act.editItem(i, day)} aria-label={`Edit ${i.title}`}><Icon name="edit" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Nothing scheduled this day.{canEdit && ' Generate a day sheet to fill it in.'}</p>
        )}
      </section>
    </>
  )
}
