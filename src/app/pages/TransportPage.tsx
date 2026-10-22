import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { eff } from '../../lib/runsheet'
import { festDay, fmtTime } from '../../lib/time'
import { HOUR, MIN, TAPE, TRANSFER_STATUS } from '../../types/constants'
import type { Id, RosItem, Transfer, TransferStatus } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { KindTag, Tel } from '../runsheet/parts'
import { useAccess, useNow, useTz } from '../session'
import { TransferForm } from '../transport/TransferForm'

const STATUS_CHIP: Record<TransferStatus, string> = { planned: 'sb', confirmed: 'ac', 'en route': 'go', done: '', cancelled: 'st' }

/** A transfer suggestion for an arrival or departure: an hour before arriving, or at departure. */
function draftFor(i: RosItem, party: number | null | undefined): Partial<Transfer> {
  const arriving = i.kind === 'arrival'
  return {
    artist: i.artist ?? null, pax: party ?? 1, item: i.id, status: 'planned',
    at: arriving ? eff(i).s - HOUR : eff(i).s,
    from: arriving ? 'Airport / hotel' : 'Artist gate',
    to: arriving ? 'Artist gate' : 'Hotel / airport',
  }
}

export function TransportPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const tz = useTz()
  const store = useStore()
  const now = useNow(30_000)
  const [day] = useDay()
  const transfers = useCollection('transfers')
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const [editing, setEditing] = useState<{ transfer: Transfer | null; draft?: Partial<Transfer> } | null>(null)
  const w = a.canW('transport', sid)
  const inScope = (artistId?: Id | null) => !artistId || (sid ? artists[artistId]?.stage === sid : a.canSeeStage(artists[artistId]?.stage ?? ''))

  const list = Object.values(transfers).filter(x => festDay(x.at, tz) === day && inScope(x.artist)).sort((x, y) => x.at - y.at)
  // Any transfer for an item covers it, including one marked as own transport.
  const covered = new Set(Object.values(transfers).map(x => x.item).filter(Boolean))
  const needs = Object.values(ros)
    .filter(i => (i.kind === 'arrival' || i.kind === 'departure') && i.artist && festDay(i.start, tz) === day && inScope(i.artist) && !covered.has(i.id) && i.status !== 'done')
    .sort((x, y) => eff(x).s - eff(y).s)
  const who = (x: Transfer) => (x.artist ? artists[x.artist]?.name ?? 'Removed' : x.guest || 'Guest')

  return (
    <>
      <div className="head">
        <div><h1>Transport</h1><p>Pickups and drop-offs for the day. Arrivals and departures without a ride are listed underneath, ready to book.</p></div>
        <div className="actions">
          <DaySelector />
          {w && <button type="button" className="btn primary" onClick={() => setEditing({ transfer: null })}>+ Add transfer</button>}
        </div>
      </div>
      <section className="panel tbl-wrap" style={{ marginBottom: '1rem' }}>
        <table>
          <thead><tr><th>Pickup</th><th>Who</th><th>People</th><th>From → to</th><th>Vehicle &amp; driver</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map(x => {
              const soon = x.status !== 'done' && x.status !== 'cancelled' && x.at - now < 30 * MIN && x.at > now - 30 * MIN
              const st = x.artist ? stages[artists[x.artist]?.stage ?? ''] : undefined
              return (
                <tr key={x.id} className={`${x.status === 'cancelled' || x.status === 'done' ? 'done' : ''}${soon ? ' soon' : ''}`}>
                  <td className="num"><b>{fmtTime(x.at, tz)}</b></td>
                  <td>
                    {x.artist ? <Link to={`${sid ? `/s/${sid}` : '/hq'}/artists/${x.artist}`} style={{ color: 'inherit' }}><b>{who(x)}</b></Link> : <b>{who(x)}</b>}
                    {st && <div className="row small"><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />{st.name}</div>}
                  </td>
                  <td className="num">{x.pax}</td>
                  <td>{x.from} → {x.to}{x.notes && <div className="small muted">{x.notes}</div>}</td>
                  <td className="small">{x.vehicle || '—'}{x.driver && <div>{x.driver} <Tel phone={x.phone} /></div>}</td>
                  <td>
                    {w
                      ? (
                        <select className="inline-sel" aria-label={`Status of ${who(x)} pickup`} value={x.status} onChange={e => void store.update('transfers', x.id, { status: e.target.value as TransferStatus })}>
                          {TRANSFER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )
                      : <span className={`chip ${STATUS_CHIP[x.status]}`}>{x.status}</span>}
                  </td>
                  <td>{w && <button type="button" className="btn sm" onClick={() => setEditing({ transfer: x })}>Edit</button>}</td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={7} className="empty">No transfers this day.</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <div className="ph"><h3>Still needs a ride</h3><span className="small muted">{needs.length} arrivals and departures</span></div>
        {needs.length ? (
          <ul className="list">
            {needs.map(i => (
              <li key={i.id}>
                <span className="num" style={{ minWidth: '3.2rem' }}><b>{fmtTime(eff(i).s, tz)}</b></span>
                <KindTag kind={i.kind} />
                <span>{artists[i.artist!]?.name} <span className="small muted">· {stages[i.stage]?.name} · {artists[i.artist!]?.party ?? '?'} people</span></span>
                {w && (
                  <span className="row" style={{ marginLeft: 'auto' }}>
                    <button type="button" className="btn sm" onClick={() => setEditing({ transfer: null, draft: draftFor(i, artists[i.artist!]?.party) })}>Book ride</button>
                    <button type="button" className="btn sm" onClick={() => void store.set('transfers', rid(), { ...draftFor(i, artists[i.artist!]?.party), status: 'cancelled', notes: 'Own transport' } as Omit<Transfer, 'id'>)}>Own transport</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="empty">Every arrival and departure has a ride.</p>}
      </section>
      {editing && <TransferForm transfer={editing.transfer} draft={editing.draft} onClose={() => setEditing(null)} />}
    </>
  )
}
