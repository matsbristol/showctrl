/*
 * One artist: their day sheet across days, contacts (if the viewer may see
 * them), production details, hotel bookings and riders.
 */
import { Link } from 'react-router-dom'
import { useNow } from '../clock/clock'
import { tapeHex } from '../domain/constants'
import { riderPerm } from '../domain/riders'
import { itemsForArtist, showsFor } from '../domain/runsheet'
import { dayLabel, festDay, fmtTime, tzCity } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { Icon } from '../shell/Icon'
import { ctxPath, stagePath, type Ctx } from '../shell/nav'
import { colourVar } from '../shell/style'
import type { Id, RiderKind } from '../types/model'
import { useAccommodationActions } from './accommodationActions'
import { useArtistActions } from './artistActions'
import { Locked, SheetRow, StatusChip, Tel } from './common'
import { useDay, useEvent } from './hooks'
import { RiderPanel } from './RiderPanel'
import { useRunsheetActions } from './runsheetActions'

export function ArtistPage({ ctx, id }: { ctx: Ctx; id: Id }) {
  const snap = useSnapshot()
  const access = useAccess()
  const { tz, T } = useEvent()
  const { day } = useDay()
  const t = useNow(60_000)
  const act = useArtistActions(ctx)
  const rs = useRunsheetActions()
  const acc = useAccommodationActions()
  const a = snap.col.artists[id]
  if (!a) return <div className="panel"><p className="empty">This {T.performer.toLowerCase()} was removed. <Link to={ctxPath(ctx, 'artists')}>Back</Link></p></div>

  const canEdit = access.canW('artists', a.stage)
  const canSchedule = access.canW('schedule', a.stage)
  const seeContacts = access.canSeeContacts(a)
  const items = itemsForArtist(snap.col.ros, id)
  const days = [...new Set(items.map(i => festDay(i.start, tz)))]
  const stage = a.stage ? snap.col.stages[a.stage] : undefined
  const bookings = Object.values(snap.col.bookings).filter(b => b.artist === id)
  const showBookings = access.moduleOn('accommodation') && access.lv('accommodation', a.stage) >= 1
  const riderKinds = (['tech', 'hosp'] as RiderKind[]).filter(k => access.moduleOn('riders') && access.lv(riderPerm(k), a.stage) >= 1)
  // The day sheet is for the artist's show day, so new items default to it.
  const showDay = showsFor(snap.col.ros, id)[0]
  const itemDay = showDay ? festDay(showDay.start, tz) : day

  return (
    <>
      <div className="head">
        <div>
          <p className="small"><Link to={ctxPath(ctx, 'artists')}>← {T.performers}</Link></p>
          <h1>{a.name}</h1>
          <p>
            {stage && <span className="row inline"><span className="tape" style={colourVar(tapeHex(stage.tape))} /><Link to={stagePath(stage.id, 'today')}>{stage.name}</Link></span>}
            {a.genre && ` · ${a.genre}`}
            {a.home && ` · ${fmtTime(t, false, a.home)} at home in ${tzCity(a.home)}`}
          </p>
        </div>
        <div className="actions">
          <StatusChip status={a.status} />
          {canEdit && <button type="button" className="btn" onClick={() => act.editArtist(a)}><Icon name="edit" />Edit</button>}
        </div>
      </div>

      <div className="grid g2">
        <section className="panel">
          <div className="ph">
            <h3>Day sheet</h3>
            {canSchedule && a.stage && (
              <div className="actions">
                <button type="button" className="btn sm" onClick={() => rs.editItem({ artist: id, stage: a.stage, kind: 'other', start: showDay?.start }, itemDay)}><Icon name="plus" />Item</button>
                <button type="button" className="btn sm primary" onClick={() => rs.daySheet(a.stage!, itemDay, a)}>{items.length ? 'Regenerate' : 'Create day sheet'}</button>
              </div>
            )}
          </div>
          {items.length ? days.map(d => (
            <div key={d}>
              <div className="dayhead">{dayLabel(d, true)}</div>
              <ul className="sheet">
                {items.filter(i => festDay(i.start, tz) === d).map(i => (
                  <SheetRow key={i.id} item={i} onClick={canSchedule ? () => rs.editItem(i, d) : undefined} />
                ))}
              </ul>
            </div>
          )) : (
            <p className="empty">No day sheet yet.{canSchedule && ` Create one from the ${T.stage.toLowerCase()} template: arrival, get in, load in, ${T.stage.toLowerCase()} access, changeover, show, load out and departure.`}</p>
          )}
        </section>

        <div className="grid start">
          <section className="panel">
            <div className="ph">
              <h3>Contacts</h3>
              {canEdit && seeContacts && <div className="actions"><button type="button" className="btn sm" onClick={() => act.editContact(a)}><Icon name="plus" />Add</button></div>}
            </div>
            {!seeContacts ? <p className="empty"><Locked /></p>
              : a.contacts?.length ? a.contacts.map(c => (
                <div key={c.id} className="contact">
                  <div>
                    {canEdit ? <button type="button" className="linkish" onClick={() => act.editContact(a, c)} aria-label={`Edit ${c.name || c.role}`}><b>{c.name}</b></button> : <b>{c.name}</b>}
                    {' '}<span className="r">{c.role}</span>
                  </div>
                  <span className="c"><Tel phone={c.phone} />{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</span>
                  {c.note && <span className="r full">{c.note}</span>}
                </div>
              ))
              : <p className="empty">No contacts yet.</p>}
          </section>

          <section className="panel">
            <div className="ph"><h3>Production</h3></div>
            <div className="pb">
              <dl className="kv">
                <dt>Travelling party</dt><dd>{a.party || '—'}</dd>
                <dt>Vehicles</dt><dd>{a.vehicles || '—'}</dd>
                {a.notes && <><dt>Notes</dt><dd className="pre">{a.notes}</dd></>}
              </dl>
            </div>
          </section>

          {showBookings && (
            <section className="panel">
              <div className="ph">
                <h3>Accommodation</h3>
                {/* Booking is festival-wide accommodation edit, not per stage. */}
                {access.canW('accommodation') && <div className="actions"><button type="button" className="btn sm" onClick={() => acc.editBooking(undefined, id)}><Icon name="plus" />Book</button></div>}
              </div>
              {bookings.length ? (
                <ul className="list">
                  {bookings.map(b => (
                    <li key={b.id}>
                      <div className="stack">
                        <b>{snap.col.hotels[b.hotel]?.name ?? 'Hotel'}</b>
                        <span className="small muted">
                          {dayLabel(b.checkIn)} → {dayLabel(b.checkOut)} · {b.rooms || 1} × {b.roomType || 'room'}
                          {seeContacts && b.conf && ` · Ref ${b.conf}`}
                        </span>
                      </div>
                      <span className={`chip push ${b.status === 'confirmed' || b.status === 'checked in' ? 'go' : 'sb'}`}>{b.status}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty">No rooms booked.</p>}
            </section>
          )}
        </div>
        {riderKinds.map(k => <RiderPanel key={k} artist={id} kind={k} showName={false} />)}
      </div>
    </>
  )
}
