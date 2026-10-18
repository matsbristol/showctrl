import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { addDays, dayKey, eventDays, festDay } from '../../lib/time'
import { BOOKING_STATUS } from '../../types/constants'
import type { Booking, BookingStatus, Hotel, Id } from '../../types/model'
import { useTerms, useTz } from '../session'
import { useServerTime } from '../time'
import { Field, FormDialog } from '../ui/Dialog'

export function HotelForm({ hotel, onClose }: { hotel: Hotel | null; onClose: () => void }) {
  const store = useStore()
  const h = hotel
  const [v, setV] = useState({
    name: h?.name ?? '', address: h?.address ?? '', contact: h?.contact ?? '', phone: h?.phone ?? '', block: String(h?.block ?? ''), notes: h?.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: string) => setV(o => ({ ...o, [k]: x }))
  return (
    <FormDialog
      title={h ? 'Edit hotel' : 'Add hotel'}
      onClose={onClose}
      onDelete={h ? () => store.delete('hotels', h.id) : undefined}
      onSave={async () => {
        if (!v.name.trim()) return 'Enter a name.'
        await store.set('hotels', h?.id ?? rid(), { ...v, name: v.name.trim(), block: Number(v.block) || 0 })
      }}
    >
      <Field label="Name" full><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Address" full><input value={v.address} onChange={e => set('address', e.target.value)} /></Field>
      <Field label="Contact person"><input value={v.contact} onChange={e => set('contact', e.target.value)} /></Field>
      <Field label="Phone"><input value={v.phone} onChange={e => set('phone', e.target.value)} /></Field>
      <Field label="Rooms held per night"><input type="number" min={0} value={v.block} onChange={e => set('block', e.target.value)} /></Field>
      <Field label="Notes" full><textarea value={v.notes} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}

/** A booking for a performer or a named guest. New performer bookings default to their first show night. */
export function BookingForm({ booking, artistId, onClose }: { booking: Booking | null; artistId?: Id; onClose: () => void }) {
  const store = useStore()
  const t = useTerms()
  const tz = useTz()
  const cfg = useConfig('event')
  const artists = useCollection('artists')
  const hotels = useCollection('hotels')
  const ros = useCollection('ros')
  const serverNow = useServerTime()
  const b = booking
  const artist0 = b?.artist ?? artistId ?? ''
  const firstShow = Object.values(ros).filter(i => i.artist === artist0 && i.kind === 'show').sort((x, y) => x.start - y.start)[0]
  const checkIn0 = b?.checkIn ?? (firstShow ? festDay(firstShow.start, tz) : eventDays(cfg)[0] ?? dayKey(serverNow(), tz))
  const hotelList = Object.values(hotels).sort((x, y) => x.name.localeCompare(y.name))
  const [v, setV] = useState({
    artist: artist0, guest: b?.guest ?? '', guestRole: b?.guestRole ?? '', hotel: b?.hotel ?? hotelList[0]?.id ?? '',
    status: (b?.status ?? 'requested') as BookingStatus, checkIn: checkIn0, checkOut: b?.checkOut ?? addDays(checkIn0, 1),
    rooms: String(b?.rooms ?? 1), roomType: b?.roomType ?? 'double', conf: b?.conf ?? '', notes: b?.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))

  return (
    <FormDialog
      title={b ? 'Edit booking' : 'Add booking'}
      onClose={onClose}
      onDelete={b ? () => store.delete('bookings', b.id) : undefined}
      onSave={async () => {
        if (!hotelList.length) return 'Add a hotel first.'
        if (!v.artist && !v.guest.trim()) return 'Choose who the booking is for.'
        if (!v.checkIn || !v.checkOut || v.checkOut <= v.checkIn) return 'Check-out must be after check-in.'
        await store.set('bookings', b?.id ?? rid(), {
          artist: v.artist || null, ...(v.artist ? {} : { guest: v.guest.trim(), guestRole: v.guestRole }),
          hotel: v.hotel, status: v.status, checkIn: v.checkIn, checkOut: v.checkOut, rooms: Number(v.rooms) || 1,
          roomType: v.roomType, conf: v.conf, notes: v.notes,
        })
      }}
    >
      <Field label={t.performer}>
        <select value={v.artist} onChange={e => set('artist', e.target.value)}>
          <option value="">Not a {t.performer.toLowerCase()}</option>
          {Object.values(artists).sort((x, y) => x.name.localeCompare(y.name)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Hotel">
        <select value={v.hotel} onChange={e => set('hotel', e.target.value)}>
          {hotelList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </Field>
      <Field label="Guest name" hidden={!!v.artist}><input value={v.guest} onChange={e => set('guest', e.target.value)} /></Field>
      <Field label="Guest is" hidden={!!v.artist}><input value={v.guestRole} placeholder="e.g. Crew, Press, VIP" onChange={e => set('guestRole', e.target.value)} /></Field>
      <Field label="Status">
        <select value={v.status} onChange={e => set('status', e.target.value as BookingStatus)}>
          {BOOKING_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Rooms"><input type="number" min={1} value={v.rooms} onChange={e => set('rooms', e.target.value)} /></Field>
      <Field label="Check-in"><input type="date" value={v.checkIn} onChange={e => set('checkIn', e.target.value)} /></Field>
      <Field label="Check-out"><input type="date" value={v.checkOut} onChange={e => set('checkOut', e.target.value)} /></Field>
      <Field label="Room type"><input value={v.roomType} placeholder="Single, double, suite" onChange={e => set('roomType', e.target.value)} /></Field>
      <Field label="Confirmation number"><input value={v.conf} onChange={e => set('conf', e.target.value)} /></Field>
      <Field label="Notes" full><textarea value={v.notes} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}
