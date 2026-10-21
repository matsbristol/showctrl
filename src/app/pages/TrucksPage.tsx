import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { clashes, locationCapacity, truckMoves } from '../../lib/trucks'
import { festDay, fmtTime } from '../../lib/time'
import { LOCATION_KINDS, MIN, TAPE } from '../../types/constants'
import type { Id, Location } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { kindLabel } from '../runsheet/helpers'
import { useAccess, useNow, useTerms, useTz } from '../session'
import { LocationForm } from '../trucks/LocationForm'

/** Truck movements for a day, where each one goes, clashes at full locations, and the locations themselves. */
export function TrucksPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const store = useStore()
  const now = useNow(30_000)
  const [day] = useDay()
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const locations = useCollection('locations')
  const [editing, setEditing] = useState<Location | 'new' | null>(null)
  const base = sid ? `/s/${sid}` : '/hq'

  const moves = truckMoves(ros).filter(i => (sid ? i.stage === sid : a.canSeeStage(i.stage)) && festDay(i.start, tz) === day)
  // Clashes are checked across all stages, since staging areas are shared.
  const allToday = truckMoves(ros).filter(i => festDay(i.start, tz) === day)
  const found = clashes(allToday, locations).filter(c => !sid || c.items.some(id => ros[id]?.stage === sid) || !locations[c.location]?.stage)
  const clashIds = new Set(found.flatMap(c => c.items))
  const total = moves.reduce((n, i) => n + (i.trucks ?? 0), 0)
  const places = Object.values(locations)
    .filter(l => !l.stage || (sid ? l.stage === sid : a.canSeeStage(l.stage)))
    .sort((x, y) => (x.stage ? 1 : 0) - (y.stage ? 1 : 0) || x.name.localeCompare(y.name))
  const destOpts = (stage: Id) => Object.values(locations).filter(l => !l.stage || l.stage === stage).sort((x, y) => x.name.localeCompare(y.name))
  const canAddPlace = a.canW('schedule') || (sid ? a.canW('schedule', sid) : a.stagesSorted().some(s => a.canW('schedule', s.id)))

  return (
    <>
      <div className="head">
        <div>
          <h1>{sid ? `Trucks · ${stages[sid]?.name}` : 'Trucks & docks'}</h1>
          <p>Every truck coming in or going out, and where to send it when it arrives. Set trucks and a location on load in and load out in the run sheet.</p>
        </div>
        <div className="actions"><DaySelector /></div>
      </div>

      {found.length > 0 && (
        <div className="panel clash-box" role="alert">
          <div className="ph"><h3>Clashes</h3><span className="badge">{found.length}</span></div>
          <ul className="list">
            {found.map(c => (
              <li key={`${c.location}-${c.from}`}>
                <b className="num">{fmtTime(c.from, tz)}–{fmtTime(c.to, tz)}</b>
                <span><b>{locations[c.location]?.name}</b> has {c.trucks} trucks booked, room for {c.capacity}: {c.items.map(id => (ros[id]?.artist && artists[ros[id].artist!]?.name) || ros[id]?.title).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="panel tbl-wrap" style={{ marginBottom: '1rem' }}>
        <div className="ph"><h3>Movements</h3><span className="small muted">{total} {total === 1 ? 'truck' : 'trucks'} this day</span></div>
        <table>
          <thead>
            <tr><th>Time</th>{!sid && <th>{t.stage}</th>}<th>{t.performer}</th><th>Movement</th><th>Trucks</th><th>Send to</th><th /></tr>
          </thead>
          <tbody>
            {moves.map(i => {
              const e = eff(i)
              const st = stages[i.stage]
              const w = a.canW('schedule', i.stage)
              const soon = i.status !== 'done' && e.s - now < 30 * MIN && e.s > now - 15 * MIN
              return (
                <tr key={i.id} className={`${i.status ?? ''}${clashIds.has(i.id) ? ' clash' : ''}${soon ? ' soon' : ''}`}>
                  <td className="num">{i.delay ? <s className="muted">{fmtTime(i.start, tz)} </s> : null}<b>{fmtTime(e.s, tz)}</b>{e.e - e.s >= 5 * MIN ? `–${fmtTime(e.e, tz)}` : ''}</td>
                  {!sid && <td>{st && <span className="row"><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />{st.name}</span>}</td>}
                  <td>{i.artist ? <Link to={`${base}/artists/${i.artist}`} style={{ color: 'inherit' }}>{artists[i.artist]?.name ?? i.title}</Link> : i.title}</td>
                  <td><span className={`kind k-${i.kind}`}>{kindLabel(i.kind)}</span></td>
                  <td className="num"><b>{i.trucks}</b></td>
                  <td>
                    {w ? (
                      <select className="inline-sel" aria-label={`Send ${i.title} to`} value={i.dest ?? ''} onChange={ev => void store.update('ros', i.id, { dest: ev.target.value || null })}>
                        <option value="">Not set</option>
                        {destOpts(i.stage).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    ) : (i.dest ? locations[i.dest]?.name : '—')}
                    {clashIds.has(i.id) && <span className="chip st" style={{ marginLeft: '.4rem' }}>Clash</span>}
                  </td>
                  <td>{i.status === 'live' ? <span className="chip go">On site</span> : i.status === 'done' ? <span className="chip">Done</span> : soon ? <span className="chip sb">Due</span> : null}</td>
                </tr>
              )
            })}
            {!moves.length && <tr><td colSpan={7} className="empty">No trucks this day. Add trucks to load in and load out items in the run sheet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="ph">
          <h3>Locations</h3>
          {canAddPlace && <div className="actions"><button type="button" className="btn sm" onClick={() => setEditing('new')}>+ Add location</button></div>}
        </div>
        <ul className="list">
          {places.map(l => {
            const cap = locationCapacity(l)
            const w = a.canW('schedule', l.stage ?? null)
            return (
              <li key={l.id}>
                <span className="chip">{LOCATION_KINDS[l.kind]}</span>
                <div className="stack">
                  <b>{l.name}</b>
                  <span className="small muted">
                    {l.stage ? stages[l.stage]?.name : 'Whole festival'} · {Number.isFinite(cap) ? `${cap} at a time` : 'no limit'}{l.notes ? ` · ${l.notes}` : ''}
                  </span>
                </div>
                {w && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(l)}>Edit</button>}
              </li>
            )
          })}
          {!places.length && <li className="muted">No locations yet. Add load bays, staging areas and truck parks.</li>}
        </ul>
      </section>

      {editing && <LocationForm location={editing === 'new' ? null : editing} sid={sid} onClose={() => setEditing(null)} />}
    </>
  )
}
