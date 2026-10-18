import { useState } from 'react'
import { useCollection, useConfig } from '../../data/hooks'
import { coversNight, eventNights, roomsUsed } from '../../lib/accommodation'
import { dayKey, dayLabel, eventDays } from '../../lib/time'
import type { Booking, Hotel } from '../../types/model'
import { BookingForm, HotelForm } from '../accommodation/forms'
import { Tel } from '../runsheet/parts'
import { useAccess, useNow, useTerms, useTz } from '../session'
import { Hidden } from './ArtistsPage'

type Dialog = { type: 'hotel'; hotel: Hotel | null } | { type: 'booking'; booking: Booking | null } | null

const statusChip = (s: Booking['status']) => (s === 'confirmed' || s === 'checked in' ? 'go' : s === 'requested' ? 'sb' : '')
const nightClass = (s: Booking['status']) => (s === 'requested' || s === 'held' ? 'req' : s === 'checked in' ? 'in' : '')

/** Hotels with their room blocks, rooms used per night, and the rooming list. */
export function AccommodationPage() {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const cfg = useConfig('event')
  const hotels = useCollection('hotels')
  const bookings = useCollection('bookings')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const today = dayKey(useNow(60_000), tz)
  const [fs, setFs] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const w = a.canW('accommodation')
  const sens = a.role() === 'admin' || a.roleDef().contacts

  const hotelList = Object.values(hotels).sort((x, y) => x.name.localeCompare(y.name))
  const active = Object.values(bookings).filter(b => b.status !== 'cancelled')
  const guest = (b: Booking) => (b.artist ? artists[b.artist]?.name ?? 'Removed' : b.guest || 'Guest')
  const list = active
    .filter(b => !fs || (b.artist && artists[b.artist]?.stage === fs))
    .sort((x, y) => x.checkIn.localeCompare(y.checkIn) || guest(x).localeCompare(guest(y)))
  const nights = eventNights(eventDays(cfg), today)

  return (
    <>
      <div className="head">
        <div>
          <h1>Accommodation</h1>
          <p>Hotels, room blocks and the rooming list for {t.performers.toLowerCase()}, crew and guests.</p>
        </div>
        {w && (
          <div className="actions">
            <button type="button" className="btn" onClick={() => setDialog({ type: 'hotel', hotel: null })}>+ Add hotel</button>
            <button type="button" className="btn primary" onClick={() => setDialog({ type: 'booking', booking: null })}>+ Add booking</button>
          </div>
        )}
      </div>

      <div className="grid g3" style={{ marginBottom: '1rem' }}>
        {hotelList.map(h => (
          <section className="panel" key={h.id}>
            <div className="ph">
              <h3>{h.name}</h3>
              {w && <div className="actions"><button type="button" className="btn sm" aria-label={`Edit ${h.name}`} onClick={() => setDialog({ type: 'hotel', hotel: h })}>Edit</button></div>}
            </div>
            <div className="pb stack small">
              {sens ? <><span>{h.address}</span><span className="muted">{h.contact} <Tel phone={h.phone} /></span></> : <Hidden />}
              <span>Block: <b>{h.block || 0}</b> rooms per night</span>
              {h.notes && <span className="muted">{h.notes}</span>}
            </div>
          </section>
        ))}
        {!hotelList.length && <div className="panel"><p className="empty">No hotels yet.</p></div>}
      </div>

      {hotelList.length > 0 && (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="ph"><h3>Rooms used per night</h3></div>
          <div className="tbl-wrap">
            <table className="nights">
              <thead><tr><th>Hotel</th>{nights.map(n => <th key={n} className="n" style={n === today ? { color: 'var(--accent)' } : undefined}>{dayLabel(n)}</th>)}</tr></thead>
              <tbody>
                {hotelList.map(h => (
                  <tr key={h.id}>
                    <td><b>{h.name}</b></td>
                    {nights.map(n => {
                      const u = roomsUsed(active, h.id, n)
                      return <td key={n} className={`n num${h.block && u > h.block ? ' over' : ''}`}>{u ? `${u}/${h.block || '–'}` : <span className="muted">·</span>}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="filters">
        <select aria-label="Stage" value={fs} onChange={e => setFs(e.target.value)}>
          <option value="">Everyone</option>
          {a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name} {t.performers.toLowerCase()}</option>)}
        </select>
      </div>
      <section className="panel">
        <div className="ph"><h3>Rooming list</h3></div>
        <div className="tbl-wrap">
          <table className="nights">
            <thead>
              <tr><th>Guest</th><th>Hotel</th><th>Rooms</th><th>Status</th>{nights.map(n => <th key={n} className="n">{dayLabel(n)}</th>)}{sens && <th>Ref</th>}</tr>
            </thead>
            <tbody>
              {list.map(b => (
                <tr key={b.id} className={w ? 'click' : undefined} onClick={w ? () => setDialog({ type: 'booking', booking: b }) : undefined}>
                  <td><b>{guest(b)}</b><div className="small muted">{b.artist ? stages[artists[b.artist]?.stage ?? '']?.name : b.guestRole}</div></td>
                  <td>{hotels[b.hotel]?.name ?? '—'}</td>
                  <td className="num">{b.rooms || 1} × {b.roomType || 'room'}</td>
                  <td><span className={`chip ${statusChip(b.status)}`}>{b.status}</span></td>
                  {nights.map(n => <td key={n} className="n">{coversNight(b, n) && <i className={nightClass(b.status)} />}</td>)}
                  {sens && <td className="small">{b.conf || '—'}</td>}
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5 + nights.length} className="empty">No bookings.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {dialog?.type === 'hotel' && <HotelForm hotel={dialog.hotel} onClose={() => setDialog(null)} />}
      {dialog?.type === 'booking' && <BookingForm booking={dialog.booking} onClose={() => setDialog(null)} />}
    </>
  )
}
