/*
 * Hotels, room blocks and the rooming list. Dates are festival-zone day
 * keys; a booking covers the nights from check-in up to (not including)
 * check-out.
 */
import type { Artist, Booking, BookingStatus, DayKey, Hotel, Id } from '../types/model'
import { addDays } from './time'

/** Nights from `a` up to, not including, `b` (capped at 60). */
export function nightsBetween(a: DayKey, b: DayKey): DayKey[] {
  const out: DayKey[] = []
  let k = a
  for (let i = 0; i < 60 && k < b; i++) {
    out.push(k)
    k = addDays(k, 1)
  }
  return out
}

/** The nights shown on the rooming grid: the event, plus the night before and after. */
export function roomingNights(start: DayKey, end: DayKey): DayKey[] {
  return nightsBetween(addDays(start, -1), addDays(end, 2))
}

export const isActive = (b: Booking) => b.status !== 'cancelled'
export const coversNight = (b: Booking, night: DayKey) => b.checkIn <= night && b.checkOut > night

/** Rooms booked at a hotel on a night, counting every booking that isn't cancelled. */
export function roomsUsed(bookings: Record<Id, Booking>, hotel: Id, night: DayKey): number {
  return Object.values(bookings)
    .filter(b => isActive(b) && b.hotel === hotel && coversNight(b, night))
    .reduce((n, b) => n + (Number(b.rooms) || 1), 0)
}

/** The artist's name, the guest's name, or a placeholder if the artist was deleted. */
export function bookingGuest(b: Booking, artists: Record<Id, Artist>, removedLabel = 'Removed'): string {
  return b.artist ? artists[b.artist]?.name ?? removedLabel : b.guest || 'Guest'
}

/** The rooming list: active bookings, optionally one stage's artists, by check-in then name. */
export function roomingList(bookings: Record<Id, Booking>, artists: Record<Id, Artist>, stage?: Id): Booking[] {
  return Object.values(bookings)
    .filter(b => isActive(b) && (!stage || (b.artist && artists[b.artist]?.stage === stage)))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || bookingGuest(a, artists).localeCompare(bookingGuest(b, artists)))
}

/** Chip colour for a booking status. */
export const bookingTone = (s: BookingStatus) => (s === 'confirmed' || s === 'checked in' ? 'go' : s === 'requested' ? 'sb' : '')

/** Cell style on the rooming grid: amber while unconfirmed, green once in. */
export const nightTone = (s: BookingStatus) => (s === 'requested' || s === 'held' ? 'req' : s === 'checked in' ? 'in' : '')

export const sortHotels = (hotels: Record<Id, Hotel>) => Object.values(hotels).sort((a, b) => a.name.localeCompare(b.name))
