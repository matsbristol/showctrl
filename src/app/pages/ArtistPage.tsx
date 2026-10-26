import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { dayLabel, festDay, fmtTime, tzCity } from '../../lib/time'
import { moduleOn } from '../../shared/modules'
import { TAPE } from '../../types/constants'
import type { Artist, ArtistContact, Id, RosItem } from '../../types/model'
import { BookingForm } from '../accommodation/forms'
import { ArtistForm, ContactForm } from '../artists/forms'
import { RiderPanel } from '../riders/RiderPanel'
import { RiskPanel } from '../risk/RiskPanel'
import { ProductionLinks } from '../artists/ProductionLinks'
import { useDay } from '../day'
import { DaySheetForm, ItemForm } from '../runsheet/forms'
import { SheetRow, StatusChip, Tel } from '../runsheet/parts'
import { useAccess, useNow, useTerms, useTz } from '../session'
import { Hidden } from './ArtistsPage'
import { tr } from '../../i18n'

type Dialog =
  | { type: 'edit' } | { type: 'daysheet' } | { type: 'item'; item: Partial<RosItem> }
  | { type: 'contact'; contact: ArtistContact | null } | { type: 'book' } | null

/** One performer: day sheet, contacts, production details, bookings and riders. */
export function ArtistDetail({ artist, sid }: { artist: Artist; sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const now = useNow(60_000)
  const cfg = useConfig('event')
  const ros = useCollection('ros')
  const stages = useCollection('stages')
  const bookings = useCollection('bookings')
  const hotels = useCollection('hotels')
  const navigate = useNavigate()
  const [day] = useDay()
  const [dialog, setDialog] = useState<Dialog>(null)
  const base = sid ? `/s/${sid}` : '/hq'
  const w = a.canW('artists', artist.stage)
  const ws = a.canW('schedule', artist.stage)
  const sens = a.artistContacts(artist)
  const st = stages[artist.stage]
  const items = Object.values(ros).filter(i => i.artist === artist.id).sort((x, y) => x.start - y.start)
  const days = [...new Set(items.map(i => festDay(i.start, tz)))]
  const bks = Object.values(bookings).filter(b => b.artist === artist.id)
  const homeNow = artist.home ? tr('{time} at home in {city}', { time: fmtTime(now, artist.home), city: tzCity(artist.home) }) : ''
  const firstShow = items.find(i => i.kind === 'show')

  return (
    <>
      <div className="head">
        <div>
          <p className="small"><Link to={`${base}/artists`}>← {t.performers}</Link></p>
          <h1>{artist.name}</h1>
          <p>
            {st && <span className="row" style={{ display: 'inline-flex' }}><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} /><Link to={`/s/${st.id}/today`}>{st.name}</Link></span>}
            {artist.genre ? ` · ${artist.genre}` : ''}{homeNow ? ` · ${homeNow}` : ''}
          </p>
        </div>
        <div className="actions">
          <StatusChip status={artist.status} />
          {w && <button type="button" className="btn" onClick={() => setDialog({ type: 'edit' })}>{tr('Edit')}</button>}
        </div>
      </div>

      <div className="grid g2">
        <section className="panel">
          <div className="ph">
            <h3>{tr('Day sheet')}</h3>
            {ws && (
              <div className="actions">
                <button type="button" className="btn sm" onClick={() => setDialog({ type: 'item', item: { artist: artist.id, stage: artist.stage, kind: 'other', start: firstShow?.start } })}>{tr('+ Item')}</button>
                <button type="button" className="btn sm primary" onClick={() => setDialog({ type: 'daysheet' })}>{items.length ? tr('Regenerate') : tr('Create day sheet')}</button>
              </div>
            )}
          </div>
          {items.length ? days.map(d => (
            <div key={d}>
              <div className="small muted" style={{ padding: '.5rem 1rem 0', fontWeight: 700 }}>{dayLabel(d, true)}</div>
              <ul className="sheet">
                {items.filter(i => festDay(i.start, tz) === d).map(i => (
                  <SheetRow key={i.id} item={i} onClick={ws ? () => setDialog({ type: 'item', item: i }) : undefined} />
                ))}
              </ul>
            </div>
          )) : (
            <p className="empty">{tr('No day sheet yet.')}{ws && ` ${tr('Create one from the stage template: arrival, get in, load in, stage access, changeover, show, load out and departure.')}`}</p>
          )}
        </section>

        <div className="grid" style={{ alignContent: 'start' }}>
          <RiskPanel artist={artist} />
          <ProductionLinks artist={artist} />
          <section className="panel">
            <div className="ph">
              <h3>{tr('Contacts')}</h3>
              {w && sens && <div className="actions"><button type="button" className="btn sm" onClick={() => setDialog({ type: 'contact', contact: null })}>{tr('+ Add')}</button></div>}
            </div>
            {!sens ? <p className="empty"><Hidden /></p>
              : artist.contacts?.length ? artist.contacts.map(c => (
                <div
                  key={c.id}
                  className={`contact${w ? ' click' : ''}`}
                  {...(w ? { role: 'button', tabIndex: 0, onClick: () => setDialog({ type: 'contact', contact: c }), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') setDialog({ type: 'contact', contact: c }) } } : {})}
                >
                  <div><b>{c.name}</b> <span className="r">{tr(c.role)}</span></div>
                  <span />
                  <span className="c" onClick={e => e.stopPropagation()}><Tel phone={c.phone} />{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</span>
                  {c.note && <span className="r" style={{ gridColumn: '1 / -1' }}>{c.note}</span>}
                </div>
              )) : <p className="empty">{tr('No contacts yet.')}</p>}
          </section>

          <section className="panel">
            <div className="ph"><h3>{tr('Production')}</h3></div>
            <div className="pb">
              <dl className="kv">
                <dt>{tr('Travelling party')}</dt><dd>{artist.party || '—'}</dd>
                <dt>{tr('Vehicles')}</dt><dd>{artist.vehicles || '—'}</dd>
                {artist.notes && <><dt>{tr('Notes')}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{artist.notes}</dd></>}
              </dl>
            </div>
          </section>

          {moduleOn(cfg, 'accommodation') && a.lv('accommodation', artist.stage) >= 1 && (
            <section className="panel">
              <div className="ph">
                <h3>{tr('Accommodation')}</h3>
                {a.canW('accommodation') && <div className="actions"><button type="button" className="btn sm" onClick={() => setDialog({ type: 'book' })}>{tr('+ Book')}</button></div>}
              </div>
              {bks.length ? (
                <ul className="list">
                  {bks.map(b => (
                    <li key={b.id}>
                      <div className="stack">
                        <b>{hotels[b.hotel]?.name ?? tr('Hotel')}</b>
                        <span className="small muted">
                          {dayLabel(b.checkIn)} → {dayLabel(b.checkOut)} · {b.rooms || 1} × {b.roomType || tr('room')}{sens && b.conf ? ` · ${tr('Ref {ref}', { ref: b.conf })}` : ''}
                        </span>
                      </div>
                      <span className={`chip ${b.status === 'confirmed' || b.status === 'checked in' ? 'go' : 'sb'}`} style={{ marginLeft: 'auto' }}>{tr(b.status)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="empty">{tr('No rooms booked.')}</p>}
            </section>
          )}
        </div>
        {moduleOn(cfg, 'riders') && (['tech', 'hosp'] as const)
          .filter(k => a.lv(k === 'tech' ? 'riders_tech' : 'riders_hosp', artist.stage) >= 1)
          .map(k => <RiderPanel key={k} artistId={artist.id} kind={k} onArtistPage />)}
      </div>

      {dialog?.type === 'edit' && (
        <ArtistForm artist={artist} sid={sid} onClose={() => setDialog(null)} onDeleted={() => navigate(`${base}/artists`, { replace: true })} />
      )}
      {dialog?.type === 'daysheet' && <DaySheetForm artist={artist} day={day} onClose={() => setDialog(null)} />}
      {dialog?.type === 'item' && <ItemForm item={dialog.item} sid={artist.stage} day={day} onClose={() => setDialog(null)} />}
      {dialog?.type === 'book' && <BookingForm booking={null} artistId={artist.id} onClose={() => setDialog(null)} />}
      {dialog?.type === 'contact' && <ContactForm artist={artist} contact={dialog.contact} onClose={() => setDialog(null)} />}
    </>
  )
}
