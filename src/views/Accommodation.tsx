/*
 * Accommodation (HQ): hotels with their room blocks, rooms used per night
 * against each block, and the rooming list. Addresses, hotel contacts and
 * confirmation numbers show only to roles allowed to see contact details.
 */
import { useState } from 'react'
import { useNow } from '../clock/clock'
import { bookingGuest, bookingTone, coversNight, nightTone, roomingList, roomingNights, roomsUsed, sortHotels } from '../domain/accommodation'
import { dayKey, dayLabel } from '../domain/time'
import { sortStages } from '../access/access'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { Icon } from '../shell/Icon'
import { Head, Locked, Tel } from './common'
import { useAccommodationActions } from './accommodationActions'
import { useEvent } from './hooks'

export function Accommodation() {
  const snap = useSnapshot()
  const access = useAccess()
  const act = useAccommodationActions()
  const { tz, T, cfg } = useEvent()
  const t = useNow(60_000)
  const [stage, setStage] = useState('')
  const canEdit = access.canW('accommodation')
  const sensitive = access.isAdmin || access.roleDef.contacts
  const hotels = sortHotels(snap.col.hotels)
  const today = dayKey(t, tz)
  const nights = cfg?.start ? roomingNights(cfg.start, cfg.end || cfg.start) : []
  const list = roomingList(snap.col.bookings, snap.col.artists, stage || undefined)
  const performers = T.performers.toLowerCase()

  return (
    <>
      <Head
        title="Accommodation"
        sub={`Hotels, room blocks and the rooming list for ${performers}, crew and guests.`}
        actions={canEdit && <>
          <button type="button" className="btn" onClick={() => act.editHotel()}><Icon name="plus" />Add hotel</button>
          <button type="button" className="btn primary" onClick={() => act.editBooking()}><Icon name="plus" />Add booking</button>
        </>}
      />

      <div className="grid g3 gap-b">
        {hotels.length ? hotels.map(h => (
          <section key={h.id} className="panel">
            <div className="ph">
              <h3>{h.name}</h3>
              {canEdit && <div className="actions"><button type="button" className="btn sm" onClick={() => act.editHotel(h)} aria-label={`Edit ${h.name}`}><Icon name="edit" /></button></div>}
            </div>
            <div className="pb stack small">
              {sensitive ? <><span>{h.address}</span><span className="muted">{h.contact} <Tel phone={h.phone} /></span></> : <Locked />}
              <span>Block: <b>{h.block || 0}</b> rooms per night</span>
              {h.notes && <span className="muted">{h.notes}</span>}
            </div>
          </section>
        )) : <div className="panel"><p className="empty">No hotels yet.</p></div>}
      </div>

      {hotels.length > 0 && (
        <section className="panel gap-b">
          <div className="ph"><h3>Rooms used per night</h3></div>
          <div className="tbl-wrap">
            <table className="nights">
              <thead>
                <tr><th>Hotel</th>{nights.map(n => <th key={n} className={`n ${n === today ? 'today' : ''}`}>{dayLabel(n)}</th>)}</tr>
              </thead>
              <tbody>
                {hotels.map(h => (
                  <tr key={h.id}>
                    <td><b>{h.name}</b></td>
                    {nights.map(n => {
                      const used = roomsUsed(snap.col.bookings, h.id, n)
                      // Red when more rooms are booked than the hotel is holding.
                      const over = !!h.block && used > h.block
                      return (
                        <td key={n} className={`n num ${over ? 'over' : ''}`} title={over ? `${used - h.block!} over the block` : undefined}>
                          {used ? `${used}/${h.block || '–'}` : <span className="muted">·</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="filters">
        <select aria-label={T.stage} value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">Everyone</option>
          {sortStages(Object.values(snap.col.stages)).map(s => <option key={s.id} value={s.id}>{s.name} {performers}</option>)}
        </select>
      </div>

      <section className="panel">
        <div className="ph"><h3>Rooming list</h3></div>
        <div className="tbl-wrap">
          <table className="nights">
            <thead>
              <tr>
                <th>Guest</th><th>Hotel</th><th>Rooms</th><th>Status</th>
                {nights.map(n => <th key={n} className="n">{dayLabel(n)}</th>)}
                {sensitive && <th>Ref</th>}
              </tr>
            </thead>
            <tbody>
              {list.map(b => {
                const artist = b.artist ? snap.col.artists[b.artist] : undefined
                return (
                  <tr key={b.id} className={canEdit ? 'click' : ''} onClick={canEdit ? () => act.editBooking(b) : undefined}>
                    <td>
                      {canEdit
                        ? <button type="button" className="linkish" onClick={e => { e.stopPropagation(); act.editBooking(b) }}><b>{bookingGuest(b, snap.col.artists, `Removed ${T.performer.toLowerCase()}`)}</b></button>
                        : <b>{bookingGuest(b, snap.col.artists, `Removed ${T.performer.toLowerCase()}`)}</b>}
                      <div className="small muted">{artist ? snap.col.stages[artist.stage ?? '']?.name : b.guestRole}</div>
                    </td>
                    <td>{snap.col.hotels[b.hotel]?.name ?? '—'}</td>
                    <td className="num">{b.rooms || 1} × {b.roomType || 'room'}</td>
                    <td><span className={`chip ${bookingTone(b.status)}`}>{b.status}</span></td>
                    {nights.map(n => <td key={n} className="n">{coversNight(b, n) && <i className={nightTone(b.status)} />}</td>)}
                    {sensitive && <td className="small">{b.conf || '—'}</td>}
                  </tr>
                )
              })}
              {!list.length && <tr><td colSpan={5 + nights.length} className="empty">No bookings.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
