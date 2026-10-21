import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { moduleOn } from '../../shared/modules'
import { ArtistRisk } from '../risk/RiskChip'
import { eff } from '../../lib/runsheet'
import { dayLabel, festDay, fmtTime, relTime } from '../../lib/time'
import { ARTIST_STATUS, TAPE } from '../../types/constants'
import type { ArtistStatus, Id } from '../../types/model'
import { ArtistForm } from '../artists/forms'
import { Icon } from '../Icon'
import { kindLabel } from '../runsheet/helpers'
import { KindTag, StatusChip, Tel } from '../runsheet/parts'
import { useAccess, useNow, useTerms, useTz } from '../session'

/** Performers for HQ (every visible stage) or one stage. */
export function ArtistsPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const now = useNow(30_000)
  const store = useStore()
  const navigate = useNavigate()
  const artists = useCollection('artists')
  const ros = useCollection('ros')
  const stages = useCollection('stages')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const base = sid ? `/s/${sid}` : '/hq'
  const cfg = useConfig('event')
  const showRisk = moduleOn(cfg, 'risk') && (sid ? a.lv('risk', sid) >= 1 : a.anyLv('risk') >= 1)

  const list = Object.values(artists)
    .filter(x => (sid ? x.stage === sid : a.canSeeStage(x.stage)) && (!q || x.name.toLowerCase().includes(q.toLowerCase())))
    .sort((x, y) => x.name.localeCompare(y.name))
  const canAdd = sid ? a.canW('artists', sid) : a.stagesSorted().some(s => a.canW('artists', s.id))
  const items = Object.values(ros).sort((x, y) => x.start - y.start)

  return (
    <>
      <div className="head">
        <div>
          <h1>{sid ? `${t.performers} · ${stages[sid]?.name}` : t.performers}</h1>
          <p>Status, show times, contacts and the full day sheet for each act. Contact details show only for roles allowed to see them.</p>
        </div>
        <div className="actions">
          <input className="inline-sel" style={{ padding: '.45rem .6rem' }} type="search" placeholder="Search" aria-label="Search" value={q} onChange={e => setQ(e.target.value)} />
          {canAdd && <button type="button" className="btn primary" onClick={() => setAdding(true)}>+ Add {t.performer.toLowerCase()}</button>}
        </div>
      </div>
      <div className="panel tbl-wrap">
        <table>
          <thead>
            <tr><th>{t.performer}</th>{!sid && <th>{t.stage}</th>}{showRisk && <th>Risk</th>}<th>On stage</th><th>Next activity</th><th>Status</th><th>Party</th><th>Main contact</th></tr>
          </thead>
          <tbody>
            {list.map(x => {
              const mine = items.filter(i => i.artist === x.id)
              const shows = mine.filter(i => i.kind === 'show')
              const nx = mine.find(i => i.status !== 'done' && eff(i).e > now)
              const c = x.contacts?.[0]
              const st = stages[x.stage]
              return (
                <tr key={x.id} className="click" onClick={() => navigate(`${base}/artists/${x.id}`)}>
                  <td><b>{x.name}</b>{x.genre && <div className="small muted">{x.genre}</div>}</td>
                  {!sid && <td>{st ? <span className="row"><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />{st.name}</span> : '—'}</td>}
                  {showRisk && <td><ArtistRisk artistId={x.id} /></td>}
                  <td className="num small">
                    {shows.length ? shows.map(s => <div key={s.id}>{dayLabel(festDay(s.start, tz))} <b>{fmtTime(eff(s).s, tz)}</b></div>) : <span className="muted">Not scheduled</span>}
                  </td>
                  <td className="small">
                    {nx ? <><KindTag kind={nx.kind} />{fmtTime(eff(nx).s, tz)} <span className="muted" title={kindLabel(nx.kind)}>{relTime(eff(nx).s, now)}</span></> : <span className="muted">—</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {a.canW('artists', x.stage)
                      ? (
                        <select className="inline-sel" aria-label={`Status of ${x.name}`} value={x.status} onChange={e => void store.update('artists', x.id, { status: e.target.value as ArtistStatus })}>
                          {ARTIST_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )
                      : <StatusChip status={x.status} />}
                  </td>
                  <td className="num">{x.party || '—'}</td>
                  <td className="small" onClick={e => e.stopPropagation()}>
                    {c ? (a.artistContacts(x) ? <>{c.name} <Tel phone={c.phone} /></> : <Hidden />) : '—'}
                  </td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={8} className="empty">No {t.performers.toLowerCase()} yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {adding && <ArtistForm artist={null} sid={sid} onClose={() => setAdding(false)} onCreated={id => navigate(`${base}/artists/${id}`)} />}
    </>
  )
}

export function Hidden() {
  return <span className="lock"><Icon name="lock" />Hidden for your role</span>
}
