/*
 * Artists list, in HQ (every visible stage) or one stage. Status can be
 * changed inline by whoever may edit that artist; the main contact shows
 * only to viewers allowed to see contact details.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNow } from '../clock/clock'
import { artistsFor, nextActivity } from '../domain/artists'
import { ARTIST_STATUS, tapeHex } from '../domain/constants'
import { eff, showsFor } from '../domain/runsheet'
import { dayLabel, festDay, fmtTime, relTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { sortStages } from '../access/access'
import { useAccess } from '../session/hooks'
import { Icon } from '../shell/Icon'
import { ctxPath } from '../shell/nav'
import { colourVar } from '../shell/style'
import type { ArtistStatus, Id } from '../types/model'
import { useArtistActions } from './artistActions'
import { Head, KindTag, Locked, StatusChip, Tel } from './common'
import { useEvent } from './hooks'

export function Artists({ sid }: { sid: Id | null }) {
  const snap = useSnapshot()
  const access = useAccess()
  const navigate = useNavigate()
  const { tz, T } = useEvent()
  const t = useNow(30_000)
  const act = useArtistActions(sid ?? 'hq')
  const [q, setQ] = useState('')
  const list = artistsFor(snap.col.artists, sid, access.canSeeStage, q)
  // In HQ you can add if you can edit artists on any stage.
  const canAdd = sid ? access.canW('artists', sid) : sortStages(Object.values(snap.col.stages)).some(s => access.canW('artists', s.id))
  const open = (id: Id) => navigate(ctxPath(sid ?? 'hq', 'artist', id))

  return (
    <>
      <Head
        title={sid ? `${T.performers} · ${snap.col.stages[sid]?.name}` : T.performers}
        sub="Status, show times, contacts and the full day sheet for each act. Contact details show only for roles allowed to see them."
        actions={<>
          <input className="inline-sel" type="search" placeholder="Search" aria-label={`Search ${T.performers.toLowerCase()}`} value={q} onChange={e => setQ(e.target.value)} />
          {canAdd && <button type="button" className="btn primary" onClick={() => act.editArtist()}><Icon name="plus" />Add {T.performer.toLowerCase()}</button>}
        </>}
      />
      <div className="panel tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>{T.performer}</th>{!sid && <th>{T.stage}</th>}<th>On {T.stage.toLowerCase()}</th>
              <th>Next activity</th><th>Status</th><th>Party</th><th>Main contact</th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => {
              const shows = showsFor(snap.col.ros, a.id)
              const nx = nextActivity(snap.col.ros, a.id, t)
              const c = a.contacts?.[0]
              const stage = a.stage ? snap.col.stages[a.stage] : undefined
              return (
                // The whole row opens the artist; the name is the keyboard-reachable link.
                <tr key={a.id} className="click" onClick={() => open(a.id)}>
                  <td>
                    <Link to={ctxPath(sid ?? 'hq', 'artist', a.id)} className="plain" onClick={e => e.stopPropagation()}><b>{a.name}</b></Link>
                    {a.genre && <div className="small muted">{a.genre}</div>}
                  </td>
                  {!sid && <td>{stage ? <span className="row nowrap"><span className="tape" style={colourVar(tapeHex(stage.tape))} />{stage.name}</span> : '—'}</td>}
                  <td className="num small">
                    {shows.length ? shows.map(s => <div key={s.id}>{dayLabel(festDay(s.start, tz))} <b>{fmtTime(eff(s).s, false, tz)}</b></div>) : <span className="muted">Not scheduled</span>}
                  </td>
                  <td className="small">
                    {nx ? <><KindTag kind={nx.kind} />{fmtTime(eff(nx).s, false, tz)} <span className="muted">{relTime(eff(nx).s, t)}</span></> : <span className="muted">—</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {access.canW('artists', a.stage)
                      ? (
                        <select className="inline-sel" value={a.status} aria-label={`Status of ${a.name}`} onChange={e => act.setStatus(a, e.target.value as ArtistStatus)}>
                          {ARTIST_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )
                      : <StatusChip status={a.status} />}
                  </td>
                  <td className="num">{a.party || '—'}</td>
                  <td className="small" onClick={e => e.stopPropagation()}>
                    {c ? (access.canSeeContacts(a) ? <>{c.name} <Tel phone={c.phone} /></> : <Locked />) : '—'}
                  </td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={7} className="empty">{q ? `No ${T.performers.toLowerCase()} match “${q}”.` : `No ${T.performers.toLowerCase()} yet.`}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
