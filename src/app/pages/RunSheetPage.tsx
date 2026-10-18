import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { eff, itemsFor, track } from '../../lib/runsheet'
import { fmtTime } from '../../lib/time'
import { MIN, TAPE, TRACKS } from '../../types/constants'
import type { Id, RosItem } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { useRunSheetActions } from '../runsheet/actions'
import { AddPerformerForm, DelayForm, ItemForm } from '../runsheet/forms'
import { KindTag, Lanes } from '../runsheet/parts'
import { useAccess, useTerms, useTz } from '../session'

type Dialog = { type: 'item'; item: Partial<RosItem> } | { type: 'delay'; item: RosItem } | { type: 'performer' } | null

/** A stage's run sheet: timeline lanes, then every item with live, done and delay controls. */
export function RunSheetPage({ sid }: { sid: Id }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const actions = useRunSheetActions()
  const [day] = useDay()
  const [filter, setFilter] = useState('all')
  const [hideDone, setHideDone] = useState(true)
  const [dialog, setDialog] = useState<Dialog>(null)
  const w = a.canW('schedule', sid)
  const st = stages[sid]

  const its = itemsFor(ros, sid, tz, day)
  const lanes = [
    { label: TRACKS.stage, color: TAPE[st.tape], short: true, items: itemsFor(ros, sid, tz, day, 'stage') },
    { label: TRACKS.dock, color: 'var(--ink3)', items: itemsFor(ros, sid, tz, day, 'dock') },
  ]
  const list = its.filter(i => (!hideDone || i.status !== 'done') && (
    filter === 'all' || (filter === 'stage' ? track(i) === 'stage' : filter === 'dock' ? track(i) === 'dock' : i.artist === filter)))
  const arts = [...new Set(its.map(i => i.artist).filter((x): x is string => !!x))]

  return (
    <>
      <div className="head">
        <div>
          <h1>Run sheet · {st.name}</h1>
          <p>Everything from get in to load out. A delay pushes everything after it and updates every clock and display.</p>
        </div>
        <div className="actions">
          <DaySelector />
          {w && <button type="button" className="btn" onClick={() => setDialog({ type: 'item', item: {} })}>+ Add item</button>}
          {w && <button type="button" className="btn primary" onClick={() => setDialog({ type: 'performer' })}>+ Add {t.performer.toLowerCase()} with day sheet</button>}
        </div>
      </div>

      <Lanes lanes={lanes} day={day} onPick={w ? it => setDialog({ type: 'item', item: it }) : undefined} />

      <div className="filters">
        <label className="small muted" htmlFor="rsf">Show</label>
        <select id="rsf" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">Everything</option>
          <option value="stage">On stage only</option>
          <option value="dock">Dock &amp; backstage only</option>
          {arts.map(id => <option key={id} value={id}>{artists[id]?.name ?? id}</option>)}
        </select>
        <label className="row small"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} /> Hide finished</label>
        {w && its.some(i => i.delay) && (
          <button type="button" className="btn sm" onClick={() => { if (confirm('Put this day back on the planned times?')) void actions.resetDelays(sid, day) }}>
            Back on planned times
          </button>
        )}
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
                        {i.delay ? <s>{fmtTime(i.start, tz)}</s> : null}
                        <b>{fmtTime(e.s, tz)}</b>{e.e - e.s >= 5 * MIN ? `–${fmtTime(e.e, tz)}` : ''}
                      </td>
                      <td>
                        <KindTag kind={i.kind} />
                        <b>{i.artist ? <Link to={`/s/${sid}/artists/${i.artist}`} style={{ color: 'inherit' }}>{i.title}</Link> : i.title}</b>
                        <div className="small muted">
                          {TRACKS[track(i)]}{i.notes ? ` · ${i.notes}` : ''}{i.delayNote ? ` · Delay: ${i.delayNote}` : ''}
                        </div>
                      </td>
                      <td>{i.status === 'live' ? <span className="chip go">Live</span> : i.status === 'done' ? <span className="chip">Done</span> : null}</td>
                      <td>
                        {w && (
                          <div className="acts">
                            {i.status === 'live'
                              ? <button type="button" className="btn sm" onClick={() => void actions.markDone(i)}>Done</button>
                              : i.status !== 'done' && <button type="button" className="btn sm go" onClick={() => void actions.goLive(i)}>{i.kind === 'show' ? 'On stage' : 'Start'}</button>}
                            {i.status !== 'done' && <button type="button" className="btn sm" onClick={() => setDialog({ type: 'delay', item: i })}>Delay</button>}
                            <button type="button" className="btn sm" onClick={() => setDialog({ type: 'item', item: i })} aria-label={`Edit ${i.title}`}>Edit</button>
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
          <p className="empty">Nothing scheduled this day.{w && ` Add a ${t.performer.toLowerCase()} to generate their day sheet.`}</p>
        )}
      </section>

      {dialog?.type === 'item' && <ItemForm item={dialog.item} sid={sid} day={day} onClose={() => setDialog(null)} />}
      {dialog?.type === 'delay' && <DelayForm item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.type === 'performer' && <AddPerformerForm sid={sid} day={day} onClose={() => setDialog(null)} />}
    </>
  )
}
