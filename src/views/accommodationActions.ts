/* Adding and editing hotels and bookings. Festival-wide accommodation edit only. */
import { now } from '../clock/clock'
import { sortArtists } from '../domain/artists'
import { sortHotels } from '../domain/accommodation'
import { BOOKING_STATUS } from '../domain/constants'
import { rid, showsFor } from '../domain/runsheet'
import { addDays, dayKey, eventDays, festDay } from '../domain/time'
import { useSnapshot, useStore } from '../data/hooks'
import type { Booking, BookingStatus, Hotel } from '../types/model'
import { useForm } from '../ui/hooks'
import { useEvent } from './hooks'

export function useAccommodationActions() {
  const store = useStore()
  const snap = useSnapshot()
  const openForm = useForm()
  const { tz, T, cfg } = useEvent()

  function editHotel(h?: Hotel) {
    openForm({
      title: h ? 'Edit hotel' : 'Add hotel',
      fields: [
        { k: 'name', label: 'Name', full: true },
        { k: 'address', label: 'Address', full: true },
        { k: 'contact', label: 'Contact person' },
        { k: 'phone', label: 'Phone' },
        { k: 'block', label: 'Rooms held per night', type: 'number' },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      values: { name: h?.name ?? '', address: h?.address ?? '', contact: h?.contact ?? '', phone: h?.phone ?? '', block: String(h?.block ?? ''), notes: h?.notes ?? '' },
      onSave: async v => {
        const name = (v.name as string).trim()
        if (!name) return 'Enter a name.'
        await store.set('hotels', h?.id ?? rid(), {
          name, address: v.address as string, contact: v.contact as string, phone: v.phone as string,
          block: Number(v.block) || 0, notes: v.notes as string,
        })
      },
      onDelete: h ? () => store.delete('hotels', h.id) : undefined,
    })
  }

  /** Add (optionally for an artist) or edit a booking. */
  function editBooking(b?: Booking, forArtist?: string) {
    const artist = b?.artist ?? forArtist
    // Default to the night of the artist's first show, else the first event day.
    const show = artist ? showsFor(snap.col.ros, artist)[0] : undefined
    const checkIn = b?.checkIn ?? (show ? festDay(show.start, tz) : eventDays(cfg?.start, cfg?.end)[0] ?? dayKey(now(), tz))
    const hotels = sortHotels(snap.col.hotels)
    openForm({
      title: b ? 'Edit booking' : 'Add booking',
      fields: [
        { k: 'artist', label: T.performer, type: 'select', options: [['', `Not a ${T.performer.toLowerCase()}`], ...sortArtists(Object.values(snap.col.artists)).map(a => [a.id, a.name] as [string, string])] },
        { k: 'guest', label: 'Guest name', show: v => !v.artist },
        { k: 'guestRole', label: 'Guest is', show: v => !v.artist, placeholder: 'e.g. Crew, Press, VIP' },
        { k: 'hotel', label: 'Hotel', type: 'select', options: hotels.map(h => [h.id, h.name]) },
        { k: 'status', label: 'Status', type: 'select', options: BOOKING_STATUS.map(s => [s, s]) },
        { k: 'checkIn', label: 'Check-in', type: 'date' },
        { k: 'checkOut', label: 'Check-out', type: 'date' },
        { k: 'rooms', label: 'Rooms', type: 'number' },
        { k: 'roomType', label: 'Room type', placeholder: 'Single, double, suite' },
        { k: 'conf', label: 'Confirmation number' },
        { k: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      values: {
        artist: artist ?? '', guest: b?.guest ?? '', guestRole: b?.guestRole ?? '', hotel: b?.hotel ?? hotels[0]?.id ?? '',
        status: b?.status ?? 'requested', checkIn, checkOut: b?.checkOut ?? addDays(checkIn, 1),
        rooms: String(b?.rooms ?? 1), roomType: b?.roomType ?? 'double', conf: b?.conf ?? '', notes: b?.notes ?? '',
      },
      onSave: async v => {
        if (!hotels.length) return 'Add a hotel first.'
        if (!v.artist && !(v.guest as string).trim()) return 'Choose who the booking is for.'
        if (!v.checkIn || !v.checkOut) return 'Set check-in and check-out.'
        if ((v.checkOut as string) <= (v.checkIn as string)) return 'Check-out must be after check-in.'
        const forArtistNow = (v.artist as string) || undefined
        await store.set('bookings', b?.id ?? rid(), {
          // A booking is for an artist or a named guest, never both.
          artist: forArtistNow,
          guest: forArtistNow ? undefined : (v.guest as string).trim(),
          guestRole: forArtistNow ? undefined : v.guestRole as string,
          hotel: v.hotel as string, status: v.status as BookingStatus,
          checkIn: v.checkIn as string, checkOut: v.checkOut as string,
          rooms: Number(v.rooms) || 1, roomType: v.roomType as string, conf: v.conf as string, notes: v.notes as string,
        })
      },
      onDelete: b ? () => store.delete('bookings', b.id) : undefined,
    })
  }

  return { editHotel, editBooking }
}
